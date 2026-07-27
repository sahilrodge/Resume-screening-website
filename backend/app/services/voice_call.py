"""Vapi AI screening voice-call business logic."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.ai.interview_evaluator import evaluate_screening_transcript
from app.core.config import settings
from app.core.exceptions import AppException, NotFoundError
from app.core.logging import get_logger
from app.crud.application import application as application_crud
from app.crud.interview import interview as interview_crud
from app.crud.voice_call import voice_call as voice_call_crud
from app.models.application import Application
from app.models.enums import InterviewType, VoiceCallStatus
from app.models.voice_call import VoiceCall
from app.schemas.voice_call import VoiceCallListResponse, VoiceCallResponse
from app.utils.vapi import DEFAULT_QUESTIONS, create_outbound_call

logger = get_logger(__name__)

_STATUS_MAP = {
    "queued": VoiceCallStatus.INITIATED,
    "initiated": VoiceCallStatus.INITIATED,
    "ringing": VoiceCallStatus.RINGING,
    "in-progress": VoiceCallStatus.IN_PROGRESS,
    "in_progress": VoiceCallStatus.IN_PROGRESS,
    "forwarding": VoiceCallStatus.IN_PROGRESS,
    "ended": VoiceCallStatus.COMPLETED,
    "completed": VoiceCallStatus.COMPLETED,
    "failed": VoiceCallStatus.FAILED,
    "busy": VoiceCallStatus.BUSY,
    "no-answer": VoiceCallStatus.NO_ANSWER,
    "no_answer": VoiceCallStatus.NO_ANSWER,
    "canceled": VoiceCallStatus.CANCELLED,
    "cancelled": VoiceCallStatus.CANCELLED,
}


def _questions_from_job(application: Application) -> list[str]:
    raw = []
    if application.job and application.job.screening_questions:
        raw = application.job.screening_questions
    cleaned = [str(q).strip() for q in (raw or []) if str(q).strip()]
    return cleaned or list(DEFAULT_QUESTIONS)


def _to_response(obj: VoiceCall) -> VoiceCallResponse:
    candidate_name = None
    if obj.candidate and obj.candidate.user:
        candidate_name = obj.candidate.user.full_name
    job_title = None
    if obj.application and obj.application.job:
        job_title = obj.application.job.title

    meta = obj.meta or {}
    evaluation = meta.get("evaluation") if isinstance(meta.get("evaluation"), dict) else {}
    questions = meta.get("screening_questions") or []
    if not isinstance(questions, list):
        questions = []

    return VoiceCallResponse(
        id=obj.id,
        user_id=obj.user_id,
        candidate_id=obj.candidate_id,
        candidate_name=candidate_name,
        application_id=obj.application_id,
        job_title=job_title,
        to_number=obj.to_number,
        from_number=obj.from_number,
        status=obj.status,
        provider_call_id=obj.provider_call_id,
        duration_seconds=obj.duration_seconds,
        recording_url=obj.recording_url,
        transcript=obj.transcript,
        interview_score=evaluation.get("interview_score"),
        evaluation_summary=evaluation.get("summary"),
        recommendation=evaluation.get("recommendation"),
        screening_questions=[str(q) for q in questions],
        started_at=obj.started_at,
        ended_at=obj.ended_at,
        error_message=obj.error_message,
        meta=meta,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


def _extract_transcript(payload: dict[str, Any]) -> str | None:
    if payload.get("transcript"):
        return str(payload["transcript"])
    artifact = payload.get("artifact") or {}
    if isinstance(artifact, dict) and artifact.get("transcript"):
        return str(artifact["transcript"])
    messages = artifact.get("messages") if isinstance(artifact, dict) else None
    if isinstance(messages, list):
        lines = []
        for msg in messages:
            if not isinstance(msg, dict):
                continue
            role = msg.get("role") or msg.get("speaker") or "unknown"
            text = msg.get("message") or msg.get("content") or msg.get("text")
            if text:
                lines.append(f"{role}: {text}")
        if lines:
            return "\n".join(lines)
    return None


class VoiceCallService:
    def list(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        application_id: uuid.UUID | None = None,
        candidate_id: uuid.UUID | None = None,
        status: VoiceCallStatus | None = None,
    ) -> VoiceCallListResponse:
        items, total, pages = voice_call_crud.list(
            db,
            page=page,
            page_size=page_size,
            application_id=application_id,
            candidate_id=candidate_id,
            status=status,
        )
        return VoiceCallListResponse(
            items=[_to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    def get(self, db: Session, call_id: uuid.UUID) -> VoiceCallResponse:
        obj = voice_call_crud.get(db, call_id)
        if obj is None:
            raise NotFoundError("Voice call not found")
        return _to_response(obj)

    def initiate_for_application(
        self,
        db: Session,
        *,
        application: Application,
        allow_missing_vapi: bool = True,
    ) -> VoiceCallResponse | None:
        """Best-effort auto-call after candidate applies."""
        try:
            return self._initiate(db, application=application, allow_missing_vapi=allow_missing_vapi)
        except AppException as exc:
            logger.warning("Vapi auto-call skipped: %s", exc.message)
            return None
        except Exception:  # noqa: BLE001
            logger.exception("Vapi auto-call failed")
            return None

    def trigger_for_application(
        self,
        db: Session,
        *,
        application_id: uuid.UUID,
    ) -> VoiceCallResponse:
        application = application_crud.get(db, application_id)
        if application is None:
            raise NotFoundError("Application not found")
        return self._initiate(db, application=application, allow_missing_vapi=False)

    def _initiate(
        self,
        db: Session,
        *,
        application: Application,
        allow_missing_vapi: bool,
    ) -> VoiceCallResponse:
        candidate = application.candidate
        if candidate is None or not candidate.phone:
            raise AppException(
                "Candidate has no phone number for Vapi call",
                status_code=400,
                code="candidate_phone_missing",
            )

        questions = _questions_from_job(application)
        candidate_name = candidate.user.full_name if candidate.user else "Candidate"
        job_title = application.job.title if application.job else "the role"
        company_name = (
            application.job.company.name if application.job and application.job.company else None
        )

        # Create linked AI voice interview record
        interview = interview_crud.create(
            db,
            application_id=application.id,
            scheduled_at=datetime.now(timezone.utc),
            interview_type=InterviewType.AI_VOICE,
            duration_minutes=15,
            meeting_link=None,
            location="Vapi AI call",
        )

        meta: dict[str, Any] = {
            "screening_questions": questions,
            "interview_id": str(interview.id),
            "job_title": job_title,
            "company_name": company_name,
            "provider": "vapi",
        }

        if not settings.vapi_configured:
            if not allow_missing_vapi:
                raise AppException(
                    "Vapi is not configured",
                    status_code=503,
                    code="vapi_not_configured",
                )
            call = voice_call_crud.create(
                db,
                to_number=candidate.phone,
                from_number="vapi:unconfigured",
                status=VoiceCallStatus.FAILED,
                candidate_id=candidate.id,
                application_id=application.id,
                user_id=candidate.user_id,
                error_message="Vapi not configured",
                meta=meta,
            )
            return _to_response(call)

        result = create_outbound_call(
            customer_number=candidate.phone,
            candidate_name=candidate_name,
            job_title=job_title,
            company_name=company_name,
            questions=questions,
            metadata={
                "application_id": str(application.id),
                "candidate_id": str(candidate.id),
                "interview_id": str(interview.id),
            },
        )

        status = _STATUS_MAP.get((result.status or "").lower(), VoiceCallStatus.INITIATED)
        if result.error or not result.call_id:
            status = VoiceCallStatus.FAILED

        call = voice_call_crud.create(
            db,
            to_number=candidate.phone,
            from_number=settings.VAPI_PHONE_NUMBER_ID or "vapi",
            status=status,
            candidate_id=candidate.id,
            application_id=application.id,
            user_id=candidate.user_id,
            provider_call_id=result.call_id,
            error_message=result.error,
            meta={**meta, "vapi_create_response": result.raw},
        )
        return _to_response(call)

    def handle_webhook(self, db: Session, payload: dict[str, Any]) -> VoiceCallResponse | None:
        """Handle Vapi server events (status-update / end-of-call-report)."""
        message = payload.get("message") if isinstance(payload.get("message"), dict) else payload
        event_type = (
            message.get("type")
            or payload.get("type")
            or message.get("event")
            or ""
        ).lower()

        call_obj = message.get("call") if isinstance(message.get("call"), dict) else {}
        provider_id = (
            call_obj.get("id")
            or message.get("callId")
            or payload.get("callId")
            or (payload.get("call") or {}).get("id")
        )
        if not provider_id:
            logger.warning("Vapi webhook missing call id: %s", event_type)
            return None

        voice = voice_call_crud.get_by_provider_id(db, str(provider_id))
        if voice is None:
            # Fallback: metadata may include our voice call id if we set it later
            logger.warning("Vapi webhook for unknown call %s", provider_id)
            return None

        updates: dict[str, Any] = {}
        status_raw = (
            message.get("status")
            or call_obj.get("status")
            or (message.get("endedReason") and "ended")
        )
        if status_raw:
            updates["status"] = _STATUS_MAP.get(str(status_raw).lower(), voice.status)

        if event_type in {"status-update", "status_update"}:
            if str(status_raw).lower() in {"in-progress", "in_progress"} and voice.started_at is None:
                updates["started_at"] = datetime.now(timezone.utc)

        transcript = _extract_transcript(message) or _extract_transcript(call_obj)
        if transcript:
            updates["transcript"] = transcript

        recording_url = (
            message.get("recordingUrl")
            or call_obj.get("recordingUrl")
            or (message.get("artifact") or {}).get("recordingUrl")
        )
        if recording_url:
            updates["recording_url"] = recording_url

        duration = message.get("durationSeconds") or call_obj.get("duration") or call_obj.get(
            "durationSeconds"
        )
        if duration is not None:
            try:
                updates["duration_seconds"] = int(float(duration))
            except (TypeError, ValueError):
                pass

        if event_type in {"end-of-call-report", "end_of_call_report", "hang"} or updates.get(
            "status"
        ) == VoiceCallStatus.COMPLETED:
            updates["status"] = VoiceCallStatus.COMPLETED
            updates["ended_at"] = datetime.now(timezone.utc)
            if "started_at" not in updates and voice.started_at is None:
                updates["started_at"] = voice.created_at

        updated = voice_call_crud.update(db, db_obj=voice, **updates)

        # Evaluate when we have a completed call + transcript
        if (
            updated.status == VoiceCallStatus.COMPLETED
            and updated.transcript
            and not (updated.meta or {}).get("evaluation")
        ):
            updated = self._evaluate_and_store(db, updated)

        return _to_response(updated)

    def _evaluate_and_store(self, db: Session, call: VoiceCall) -> VoiceCall:
        meta = dict(call.meta or {})
        questions = meta.get("screening_questions") or DEFAULT_QUESTIONS
        job_title = meta.get("job_title") or (
            call.application.job.title if call.application and call.application.job else "the role"
        )
        try:
            evaluation = evaluate_screening_transcript(
                transcript=call.transcript or "",
                job_title=str(job_title),
                questions=[str(q) for q in questions],
            )
            meta["evaluation"] = evaluation.model_dump()
            call = voice_call_crud.update(db, db_obj=call, meta=meta)

            # Persist score onto linked Interview if present
            interview_id = meta.get("interview_id")
            if interview_id:
                interview = interview_crud.get(db, uuid.UUID(str(interview_id)))
                if interview is not None:
                    interview.rating = int(round(evaluation.interview_score / 10))  # 0-10
                    interview.feedback = (
                        f"{evaluation.summary}\n\n"
                        f"Recommendation: {evaluation.recommendation}\n"
                        f"Reasoning: {evaluation.reasoning}"
                    )
                    from app.models.enums import InterviewStatus

                    interview.status = InterviewStatus.COMPLETED
                    db.add(interview)
                    db.commit()
                    call = voice_call_crud.get(db, call.id)  # type: ignore[assignment]
        except AppException as exc:
            logger.warning("Interview evaluation skipped: %s", exc.message)
            meta["evaluation_error"] = exc.message
            call = voice_call_crud.update(db, db_obj=call, meta=meta)
        except Exception:  # noqa: BLE001
            logger.exception("Interview evaluation failed")
        return call  # type: ignore[return-value]


voice_call_service = VoiceCallService()
