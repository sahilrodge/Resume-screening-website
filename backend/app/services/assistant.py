"""Recruitment assistant business logic."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.ai.recruitment_assistant import run_recruitment_assistant
from app.core.exceptions import AppException, NotFoundError
from app.crud.application import application as application_crud
from app.crud.assistant import assistant as assistant_crud
from app.crud.candidate import candidate as candidate_crud
from app.crud.job import job as job_crud
from app.models.application import Application
from app.models.assistant import AssistantConversation, AssistantMessage
from app.models.enums import ChatRole, InterviewType, JobStatus
from app.models.job import Job
from app.models.user import User
from app.schemas.assistant import (
    ChatReplyResponse,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    AssistantMessageResponse,
    MessageCreate,
)
from app.schemas.interview import InterviewCreate
from app.services.interview import interview_service


def _msg_to_response(msg: AssistantMessage) -> AssistantMessageResponse:
    return AssistantMessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        meta=msg.meta,
        created_at=msg.created_at,
    )


def _conv_to_response(obj: AssistantConversation, *, include_messages: bool = True) -> ConversationResponse:
    candidate_name = None
    if obj.candidate and obj.candidate.user:
        candidate_name = obj.candidate.user.full_name
    job_title = obj.job.title if obj.job else None
    messages = []
    if include_messages:
        messages = [_msg_to_response(m) for m in (obj.messages or [])]
    return ConversationResponse(
        id=obj.id,
        title=obj.title,
        created_by_user_id=obj.created_by_user_id,
        candidate_id=obj.candidate_id,
        candidate_name=candidate_name,
        job_id=obj.job_id,
        job_title=job_title,
        application_id=obj.application_id,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
        messages=messages,
    )


def _build_context(db: Session, conversation: AssistantConversation) -> str:
    parts: list[str] = []

    # Open jobs overview
    jobs = list(
        db.scalars(
            select(Job)
            .options(joinedload(Job.company))
            .where(Job.status == JobStatus.OPEN)
            .order_by(Job.created_at.desc())
            .limit(15)
        ).unique().all()
    )
    if jobs:
        lines = []
        for j in jobs:
            company = j.company.name if j.company else "Unknown"
            lines.append(
                f"- id={j.id} | {j.title} @ {company} | {j.location or 'n/a'} | "
                f"{j.employment_type.value} | openings={j.openings}"
            )
        parts.append("OPEN JOBS:\n" + "\n".join(lines))

    if conversation.job_id:
        job = job_crud.get(db, conversation.job_id)
        if job:
            company = job.company.name if job.company else None
            parts.append(
                "FOCUSED JOB:\n"
                f"id={job.id}\n"
                f"title={job.title}\n"
                f"company={company}\n"
                f"location={job.location}\n"
                f"employment_type={job.employment_type.value}\n"
                f"status={job.status.value}\n"
                f"experience={job.experience_min_years}-{job.experience_max_years} years\n"
                f"salary={job.salary_min}-{job.salary_max} {job.currency}\n"
                f"description:\n{job.description[:6000]}"
            )

    if conversation.candidate_id:
        cand = candidate_crud.get(db, conversation.candidate_id)
        if cand and cand.user:
            parts.append(
                "CANDIDATE:\n"
                f"id={cand.id}\n"
                f"name={cand.user.full_name}\n"
                f"email={cand.user.email}\n"
                f"phone={cand.phone}\n"
                f"title={cand.current_title}\n"
                f"location={cand.location}\n"
                f"headline={cand.headline}\n"
                f"years_experience={cand.years_experience}\n"
                f"summary={(cand.summary or '')[:1500]}"
            )
            apps, _, _ = application_crud.list(
                db,
                page=1,
                page_size=20,
                candidate_id=cand.id,
            )
            if apps:
                app_lines = []
                for a in apps:
                    jt = a.job.title if a.job else "?"
                    app_lines.append(
                        f"- application_id={a.id} | job={jt} | status={a.status.value} | "
                        f"match_score={a.match_score}"
                    )
                parts.append("CANDIDATE APPLICATIONS:\n" + "\n".join(app_lines))

    if conversation.application_id:
        app = application_crud.get(db, conversation.application_id)
        if app:
            jt = app.job.title if app.job else "?"
            parts.append(
                "FOCUSED APPLICATION:\n"
                f"application_id={app.id}\n"
                f"job={jt}\n"
                f"status={app.status.value}\n"
                f"match_score={app.match_score}\n"
                f"summary={(app.ai_summary or '')[:1000]}"
            )

    parts.append(
        "CAPABILITIES:\n"
        "- Explain any open job using FOCUSED JOB / OPEN JOBS.\n"
        "- Answer process questions (screening, interviews, notifications).\n"
        "- Schedule interview via action when application_id + scheduled_at are known."
    )
    return "\n\n".join(parts)


def _execute_schedule_action(
    db: Session,
    *,
    conversation: AssistantConversation,
    action: dict[str, Any],
) -> dict[str, Any] | None:
    if (action.get("type") or "").lower() != "schedule_interview":
        return None

    application_id_raw = action.get("application_id") or conversation.application_id
    if not application_id_raw:
        return {
            "ok": False,
            "error": "application_id_required",
            "message": "Need an application to schedule an interview.",
        }

    scheduled_raw = action.get("scheduled_at")
    if not scheduled_raw:
        return {
            "ok": False,
            "error": "scheduled_at_required",
            "message": "Need a date/time to schedule.",
        }

    try:
        application_id = uuid.UUID(str(application_id_raw))
        if isinstance(scheduled_raw, datetime):
            scheduled_at = scheduled_raw
        else:
            scheduled_at = datetime.fromisoformat(str(scheduled_raw).replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        return {"ok": False, "error": "invalid_schedule_payload"}

    itype_raw = str(action.get("interview_type") or "video").lower()
    try:
        interview_type = InterviewType(itype_raw)
    except ValueError:
        interview_type = InterviewType.VIDEO

    try:
        created = interview_service.create(
            db,
            data=InterviewCreate(
                application_id=application_id,
                scheduled_at=scheduled_at,
                interview_type=interview_type,
                duration_minutes=int(action.get("duration_minutes") or 60),
                meeting_link=action.get("meeting_link"),
                location=action.get("location"),
            ),
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "schedule_failed", "message": str(exc)}

    # Persist application on conversation for continuity
    if conversation.application_id is None:
        conversation.application_id = application_id
        db.add(conversation)
        db.commit()

    return {
        "ok": True,
        "type": "schedule_interview",
        "interview_id": str(created.id),
        "application_id": str(created.application_id),
        "scheduled_at": created.scheduled_at.isoformat(),
        "interview_type": created.interview_type.value,
        "candidate_name": created.candidate_name,
        "job_title": created.job_title,
    }


class AssistantService:
    def create_conversation(
        self,
        db: Session,
        *,
        user: User,
        data: ConversationCreate,
    ) -> ConversationResponse:
        if data.job_id and job_crud.get(db, data.job_id) is None:
            raise NotFoundError("Job not found")
        if data.candidate_id and candidate_crud.get(db, data.candidate_id) is None:
            raise NotFoundError("Candidate not found")
        if data.application_id and application_crud.get(db, data.application_id) is None:
            raise NotFoundError("Application not found")

        title = (data.title or "New chat").strip() or "New chat"
        created = assistant_crud.create_conversation(
            db,
            created_by_user_id=user.id,
            title=title,
            candidate_id=data.candidate_id,
            job_id=data.job_id,
            application_id=data.application_id,
        )
        # Seed welcome message
        assistant_crud.add_message(
            db,
            conversation_id=created.id,
            role=ChatRole.ASSISTANT,
            content=(
                "Hi! I'm the HirePulse recruitment assistant. "
                "I can explain open roles, answer candidate questions, "
                "and help schedule interviews. What would you like to do?"
            ),
            meta={"kind": "welcome"},
        )
        refreshed = assistant_crud.get_conversation(db, created.id)
        assert refreshed is not None
        return _conv_to_response(refreshed)

    def list_conversations(
        self,
        db: Session,
        *,
        user: User,
        page: int = 1,
        page_size: int = 30,
    ) -> ConversationListResponse:
        items, total = assistant_crud.list_conversations(
            db,
            user_id=user.id,
            skip=(page - 1) * page_size,
            limit=page_size,
        )
        return ConversationListResponse(
            items=[_conv_to_response(i, include_messages=False) for i in items],
            total=total,
        )

    def get_conversation(
        self,
        db: Session,
        conversation_id: uuid.UUID,
        *,
        user: User | None = None,
    ) -> ConversationResponse:
        obj = assistant_crud.get_conversation(db, conversation_id)
        if obj is None:
            raise NotFoundError("Conversation not found")
        if user is not None and obj.user_id != user.id:
            raise NotFoundError("Conversation not found")
        return _conv_to_response(obj)

    def send_message(
        self,
        db: Session,
        *,
        conversation_id: uuid.UUID,
        data: MessageCreate,
        user: User | None = None,
    ) -> ChatReplyResponse:
        conversation = assistant_crud.get_conversation(db, conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation not found")
        if user is not None and conversation.user_id != user.id:
            raise NotFoundError("Conversation not found")

        content = data.content.strip()
        if not content:
            raise AppException("Message cannot be empty", status_code=400, code="empty_message")

        assistant_crud.add_message(
            db,
            conversation_id=conversation.id,
            role=ChatRole.USER,
            content=content,
        )
        if conversation.title == "New chat":
            assistant_crud.touch_title(
                db,
                conversation_id=conversation.id,
                title=content[:60],
            )

        conversation = assistant_crud.get_conversation(db, conversation.id)
        assert conversation is not None

        history = [
            {"role": m.role.value, "content": m.content}
            for m in conversation.messages
            if m.role in {ChatRole.USER, ChatRole.ASSISTANT}
            and not (m.meta or {}).get("kind") == "welcome"
        ]
        # exclude the just-added user message from history (passed separately)
        if history and history[-1]["content"] == content:
            history = history[:-1]

        context = _build_context(db, conversation)
        llm = run_recruitment_assistant(
            context_block=context,
            history=history,
            user_message=content,
        )

        action_result = None
        meta: dict[str, Any] = {}
        if llm.action:
            meta["proposed_action"] = llm.action
            action_result = _execute_schedule_action(
                db,
                conversation=conversation,
                action=llm.action,
            )
            meta["action_result"] = action_result
            if action_result and action_result.get("ok"):
                # Append confirmation to reply if not already clear
                if "scheduled" not in llm.reply.lower():
                    llm.reply = (
                        f"{llm.reply}\n\n"
                        f"Interview scheduled for {action_result.get('scheduled_at')} "
                        f"({action_result.get('interview_type')})."
                    )

        assistant_msg = assistant_crud.add_message(
            db,
            conversation_id=conversation.id,
            role=ChatRole.ASSISTANT,
            content=llm.reply,
            meta=meta or None,
        )

        refreshed = assistant_crud.get_conversation(db, conversation.id)
        assert refreshed is not None
        return ChatReplyResponse(
            conversation=_conv_to_response(refreshed),
            reply=_msg_to_response(assistant_msg),
            action_result=action_result,
        )


assistant_service = AssistantService()
