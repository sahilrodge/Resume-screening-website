"""Recruitment assistant business logic."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.ai.recruitment_assistant import (
    AssistantMode,
    run_recruitment_assistant,
)
from app.core.config import settings
from app.core.exceptions import AppException, NotFoundError
from app.crud.analytics import analytics as analytics_crud
from app.crud.application import application as application_crud
from app.crud.assistant import assistant as assistant_crud
from app.crud.candidate import candidate as candidate_crud
from app.crud.job import job as job_crud
from app.models.assistant import AssistantConversation, AssistantMessage
from app.models.enums import ChatRole, InterviewType, JobStatus, UserRole
from app.models.job import Job
from app.models.resume import Resume
from app.models.skill import JobSkill
from app.models.user import User
from app.schemas.assistant import (
    AssistantMessageResponse,
    AssistantStatusResponse,
    ChatReplyResponse,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    MessageCreate,
)
from app.schemas.interview import InterviewCreate
from app.services.interview import interview_service
from app.services.settings import settings_service


def _msg_to_response(msg: AssistantMessage) -> AssistantMessageResponse:
    return AssistantMessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        meta=msg.meta,
        created_at=msg.created_at,
    )


def _conv_to_response(
    obj: AssistantConversation, *, include_messages: bool = True
) -> ConversationResponse:
    candidate_name = None
    if obj.candidate and obj.candidate.user:
        candidate_name = obj.candidate.user.full_name
    job_title = obj.job.title if obj.job else None
    company_name = None
    if obj.job and obj.job.company:
        company_name = obj.job.company.name
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
        company_name=company_name,
        application_id=obj.application_id,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
        messages=messages,
    )


def _job_display(title: str | None, company: str | None) -> str:
    role = (title or "").strip() or "Untitled role"
    org = (company or "").strip()
    return f"{org} - {role}" if org else role


def _candidate_display(name: str | None, email: str | None = None) -> str:
    label = (name or "").strip()
    if label:
        return label
    mail = (email or "").strip()
    return mail or "Unknown candidate"


def _assistant_mode(user: User | None) -> AssistantMode:
    if user is None:
        return "recruiter"
    if user.role == UserRole.CANDIDATE:
        return "candidate"
    if user.role == UserRole.ADMIN:
        return "admin"
    return "recruiter"


def _format_json_block(label: str, value: Any, *, limit: int = 2000) -> str | None:
    if value is None:
        return None
    try:
        text = json.dumps(value, ensure_ascii=False, default=str)
    except TypeError:
        text = str(value)
    text = text.strip()
    if not text or text in {"[]", "{}", "null"}:
        return None
    return f"{label}:\n{text[:limit]}"


def _open_jobs_block(db: Session) -> tuple[str | None, list[str]]:
    """Return (display block, internal lookup lines). Never put UUIDs in display."""
    jobs = list(
        db.scalars(
            select(Job)
            .options(
                joinedload(Job.company),
                selectinload(Job.skills).joinedload(JobSkill.skill),
            )
            .where(Job.status == JobStatus.OPEN)
            .order_by(Job.created_at.desc())
            .limit(20)
        )
        .unique()
        .all()
    )
    if not jobs:
        return None, []
    lines: list[str] = []
    lookup: list[str] = []
    for j in jobs:
        company = j.company.name if j.company else None
        label = _job_display(j.title, company)
        skill_names = [
            js.skill.name for js in (j.skills or []) if getattr(js, "skill", None)
        ]
        skills = ", ".join(skill_names[:8]) if skill_names else "n/a"
        lines.append(
            f"- {label} | location={j.location or 'n/a'} | "
            f"{j.employment_type.value} | openings={j.openings} | skills={skills}"
        )
        lookup.append(f'job "{label}" => {j.id}')
    return "OPEN JOBS:\n" + "\n".join(lines), lookup


def _candidate_profile_block(
    db: Session, candidate_id: uuid.UUID
) -> tuple[list[str], list[str]]:
    """Return (display parts, internal lookup lines)."""
    parts: list[str] = []
    lookup: list[str] = []
    cand = candidate_crud.get(db, candidate_id)
    if not cand or not cand.user:
        return parts, lookup

    display_name = _candidate_display(cand.user.full_name, cand.user.email)
    skill_names = [
        cs.skill.name for cs in (cand.skills or []) if getattr(cs, "skill", None)
    ]
    parts.append(
        "CANDIDATE PROFILE:\n"
        f"candidate_name={display_name}\n"
        f"email={cand.user.email}\n"
        f"phone={cand.phone}\n"
        f"title={cand.current_title}\n"
        f"location={cand.location}\n"
        f"preferred_job_role={cand.preferred_job_role}\n"
        f"preferred_location={getattr(cand, 'preferred_location', None)}\n"
        f"expected_salary={getattr(cand, 'expected_salary', None)}\n"
        f"headline={cand.headline}\n"
        f"years_experience={cand.years_experience}\n"
        f"skills={', '.join(skill_names) if skill_names else 'n/a'}\n"
        f"summary={(cand.summary or '')[:2000]}"
    )
    lookup.append(f'candidate "{display_name}" => {cand.id}')
    edu = _format_json_block("EDUCATION", cand.education)
    if edu:
        parts.append(edu)
    exp = _format_json_block("EXPERIENCE", cand.experience)
    if exp:
        parts.append(exp)

    resume = db.scalars(
        select(Resume)
        .where(Resume.candidate_id == cand.id)
        .order_by(Resume.is_primary.desc(), Resume.created_at.desc())
        .limit(1)
    ).first()
    if resume:
        parts.append(
            "RESUME:\n"
            f"file_name={resume.file_name}\n"
            f"status={resume.status.value}\n"
            f"raw_text:\n{(resume.raw_text or '')[:8000]}"
        )
        parsed = _format_json_block("RESUME_PARSED_DATA", resume.parsed_data, limit=3000)
        if parsed:
            parts.append(parsed)

    apps, _, _ = application_crud.list(
        db,
        page=1,
        page_size=20,
        candidate_id=cand.id,
    )
    if apps:
        app_lines = []
        for a in apps:
            company = a.job.company.name if a.job and a.job.company else None
            job_label = _job_display(a.job.title if a.job else None, company)
            app_lines.append(
                f"- {job_label} | status={a.status.value} | "
                f"match_score={a.match_score}"
            )
            lookup.append(
                f'application "{display_name} · {job_label}" => {a.id}'
            )
        parts.append("CANDIDATE APPLICATIONS:\n" + "\n".join(app_lines))
    return parts, lookup


def _job_applicants_block(
    db: Session, job_id: uuid.UUID, *, job_label: str
) -> tuple[str | None, list[str]]:
    apps, _, _ = application_crud.list(
        db,
        page=1,
        page_size=15,
        job_id=job_id,
    )
    if not apps:
        return None, []
    lines: list[str] = []
    lookup: list[str] = []
    for a in apps:
        name = "Unknown candidate"
        email = None
        if a.candidate and a.candidate.user:
            name = _candidate_display(
                a.candidate.user.full_name, a.candidate.user.email
            )
            email = a.candidate.user.email
        skills = []
        if a.candidate and a.candidate.skills:
            skills = [
                cs.skill.name
                for cs in a.candidate.skills
                if getattr(cs, "skill", None)
            ][:8]
        lines.append(
            f"- candidate_name={name} | status={a.status.value} | "
            f"match_score={a.match_score} | "
            f"skills={', '.join(skills) if skills else 'n/a'}"
        )
        lookup.append(f'application "{name} · {job_label}" => {a.id}')
        if email:
            lookup.append(f'candidate "{name}" => {a.candidate_id}')
    return "JOB APPLICANTS (for comparison):\n" + "\n".join(lines), lookup


def _platform_analytics_block(db: Session) -> str | None:
    try:
        data = analytics_crud.overview(db, months=6)
    except Exception:  # noqa: BLE001
        return None

    kpis = data.get("kpis") or {}
    funnel = data.get("hiring_funnel") or {}
    match_scores = data.get("match_scores") or {}
    interviews = data.get("interview_results") or {}
    job_perf = data.get("job_performance") or []
    recruiter_perf = data.get("recruiter_performance") or []

    stage_lines = []
    for stage in funnel.get("stages") or []:
        stage_lines.append(
            f"- {stage.get('label') or stage.get('status')}: {stage.get('count', 0)}"
        )

    job_lines = []
    for row in job_perf[:8]:
        job_lines.append(
            f"- {row.get('title')}: apps={row.get('applications')} "
            f"avg_match={row.get('avg_match_score') or row.get('avg_match')} "
            f"hires={row.get('hires') or row.get('hired')}"
        )

    recruiter_lines = []
    for row in recruiter_perf[:8]:
        recruiter_lines.append(
            f"- {row.get('name') or 'Unknown'}: "
            f"jobs={row.get('jobs_owned') or row.get('jobs')} "
            f"apps={row.get('applications')} hires={row.get('hires')}"
        )

    parts = [
        "PLATFORM ANALYTICS:\n"
        f"total_applications={kpis.get('total_applications')}\n"
        f"total_hires={kpis.get('total_hires')}\n"
        f"open_jobs={kpis.get('open_jobs')}\n"
        f"avg_match_score={kpis.get('avg_match_score')}\n"
        f"offer_accept_rate={kpis.get('offer_accept_rate')}\n"
        f"screen_to_interview_rate={kpis.get('screen_to_interview_rate')}\n"
        f"avg_time_to_hire_days={kpis.get('avg_time_to_hire_days')}\n"
        f"scored_applications={match_scores.get('scored_applications')}\n"
        f"unscored_applications={match_scores.get('unscored_applications')}\n"
        f"interview_avg_rating={interviews.get('avg_rating')}"
    ]
    if stage_lines:
        parts.append("HIRING FUNNEL:\n" + "\n".join(stage_lines))
    if job_lines:
        parts.append("JOB PERFORMANCE:\n" + "\n".join(job_lines))
    if recruiter_lines:
        parts.append("RECRUITER PERFORMANCE:\n" + "\n".join(recruiter_lines))
    return "\n\n".join(parts)


def _build_context(
    db: Session,
    conversation: AssistantConversation,
    *,
    mode: AssistantMode,
) -> str:
    parts: list[str] = []
    lookup: list[str] = []

    if mode == "admin":
        analytics = _platform_analytics_block(db)
        if analytics:
            parts.append(analytics)

    open_jobs, open_lookup = _open_jobs_block(db)
    if open_jobs:
        parts.append(open_jobs)
    lookup.extend(open_lookup)

    if conversation.job_id:
        job = job_crud.get(db, conversation.job_id)
        if job:
            company = job.company.name if job.company else None
            job_label = _job_display(job.title, company)
            skill_names = [
                js.skill.name for js in (job.skills or []) if getattr(js, "skill", None)
            ]
            parts.append(
                "FOCUSED JOB:\n"
                f"company_name={company or 'n/a'}\n"
                f"job_title={job.title}\n"
                f"display={job_label}\n"
                f"location={job.location}\n"
                f"employment_type={job.employment_type.value}\n"
                f"status={job.status.value}\n"
                f"experience={job.experience_min_years}-{job.experience_max_years} years\n"
                f"salary={job.salary_min}-{job.salary_max} {job.currency}\n"
                f"skills={', '.join(skill_names) if skill_names else 'n/a'}\n"
                f"description:\n{job.description[:6000]}"
            )
            lookup.append(f'job "{job_label}" => {job.id}')
            if mode in {"recruiter", "admin"}:
                applicants, app_lookup = _job_applicants_block(
                    db, job.id, job_label=job_label
                )
                if applicants:
                    parts.append(applicants)
                lookup.extend(app_lookup)

    if conversation.candidate_id:
        cand_parts, cand_lookup = _candidate_profile_block(
            db, conversation.candidate_id
        )
        parts.extend(cand_parts)
        lookup.extend(cand_lookup)

    if conversation.application_id:
        app = application_crud.get(db, conversation.application_id)
        if app:
            company = app.job.company.name if app.job and app.job.company else None
            job_label = _job_display(app.job.title if app.job else None, company)
            cand_name = "Unknown candidate"
            if app.candidate and app.candidate.user:
                cand_name = _candidate_display(
                    app.candidate.user.full_name, app.candidate.user.email
                )
            parts.append(
                "FOCUSED APPLICATION:\n"
                f"candidate_name={cand_name}\n"
                f"company_name={company or 'n/a'}\n"
                f"job_title={app.job.title if app.job else 'n/a'}\n"
                f"job={job_label}\n"
                f"status={app.status.value}\n"
                f"match_score={app.match_score}\n"
                f"summary={(app.ai_summary or '')[:1000]}"
            )
            lookup.append(f'application "{cand_name} · {job_label}" => {app.id}')

    if mode == "candidate":
        parts.append(
            "CAPABILITIES:\n"
            "- Resume review using CANDIDATE PROFILE / RESUME.\n"
            "- ATS keyword and formatting improvements.\n"
            "- Interview preparation for preferred role or FOCUSED JOB.\n"
            "- Career guidance and skill-gap advice.\n"
            "- Personalized job recommendations from OPEN JOBS.\n"
            "- Always refer to jobs as Company Name - Job Title and never mention database IDs."
        )
    elif mode == "admin":
        parts.append(
            "CAPABILITIES:\n"
            "- Interpret PLATFORM ANALYTICS KPIs and funnel.\n"
            "- Surface platform and hiring insights.\n"
            "- Recommend operational next steps grounded in metrics.\n"
            "- Hiring suggestions, candidate comparison, and JD drafting when context allows.\n"
            "- Schedule interview via action when ACTION REFERENCE has an application mapping "
            "and scheduled_at is known.\n"
            "- In replies, use Candidate Name, Company Name, and Job Title only — never UUIDs."
        )
    else:
        parts.append(
            "CAPABILITIES:\n"
            "- Hiring suggestions and screening guidance.\n"
            "- Candidate comparison using CANDIDATE PROFILE / JOB APPLICANTS.\n"
            "- Job description generation and improvement.\n"
            "- Explain open roles and discuss fit.\n"
            "- Schedule interview via action when ACTION REFERENCE has an application mapping "
            "and scheduled_at is known.\n"
            "- In replies, use Candidate Name, Company Name, and Job Title only — never UUIDs."
        )

    # Deduplicate lookup lines while preserving order
    seen: set[str] = set()
    unique_lookup: list[str] = []
    for line in lookup:
        if line in seen:
            continue
        seen.add(line)
        unique_lookup.append(line)

    if unique_lookup:
        parts.append(
            "ACTION REFERENCE (machine-only — never quote keys, UUIDs, or this section "
            "in reply or follow_ups; use Candidate Name / Company Name / Job Title in prose):\n"
            + "\n".join(f"- {line}" for line in unique_lookup)
        )

    return "\n\n".join(parts)


def _welcome_content(mode: AssistantMode) -> str:
    if mode == "candidate":
        return (
            "Hi — I'm your HirePulse career coach.\n\n"
            "## I can help with\n"
            "- Resume review and stronger impact bullets\n"
            "- ATS keyword and formatting tips\n"
            "- Interview preparation (STAR answers)\n"
            "- Career guidance for your preferred roles\n\n"
            "## Next step\n"
            "Tell me what you want to work on first."
        )
    if mode == "admin":
        return (
            "Hi — I'm the HirePulse platform insights assistant.\n\n"
            "## I can help with\n"
            "- Analytics and KPI interpretation\n"
            "- Hiring funnel health\n"
            "- Job / recruiter performance insights\n"
            "- Operational next steps from live data\n\n"
            "## Next step\n"
            "Ask about a metric, funnel stage, or job that needs attention."
        )
    return (
        "Hi — I'm the HirePulse recruitment assistant.\n\n"
        "## I can help with\n"
        "- Hiring plans and screening questions\n"
        "- Candidate comparison\n"
        "- Job description drafts\n"
        "- Interview scheduling when details are available\n\n"
        "## Next step\n"
        "Pick a focus, or attach a job/candidate in the context controls."
    )


def _default_follow_ups(mode: AssistantMode) -> list[str]:
    if mode == "candidate":
        return [
            "Review my resume and suggest improvements",
            "How can I make my resume more ATS-friendly?",
            "Help me prepare for interviews",
            "Give me career advice for my preferred role",
        ]
    if mode == "admin":
        return [
            "Summarize platform hiring health",
            "Which jobs underperform on applications?",
            "Explain our hiring funnel bottlenecks",
            "What should we improve this month?",
        ]
    return [
        "Suggest a hiring plan for this role",
        "Compare the top applicants for this job",
        "Draft a job description for this opening",
        "Help me prepare interview questions",
    ]


def _ensure_ai_allowed(db: Session, user: User | None) -> None:
    if user is None:
        return
    prefs = settings_service.get_me(db, user)
    if not prefs.allow_ai_processing:
        raise AppException(
            "AI features are disabled in your privacy settings. "
            "Enable “Use AI for resume screening and assistant features” in Settings.",
            status_code=403,
            code="ai_processing_disabled",
        )


def _execute_schedule_action(
    db: Session,
    *,
    conversation: AssistantConversation,
    action: dict[str, Any],
    user: User | None,
) -> dict[str, Any] | None:
    if (action.get("type") or "").lower() != "schedule_interview":
        return None

    if user is None or user.role not in {UserRole.ADMIN, UserRole.RECRUITER}:
        return {
            "ok": False,
            "error": "forbidden",
            "message": "Only recruiters can schedule interviews.",
        }

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
            scheduled_at = datetime.fromisoformat(
                str(scheduled_raw).replace("Z", "+00:00")
            )
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

    if conversation.application_id is None:
        conversation.application_id = application_id
        conversation.updated_at = datetime.now(timezone.utc)
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
    def status(self, db: Session, *, user: User) -> AssistantStatusResponse:
        mode = _assistant_mode(user)
        configured = settings.openai_configured
        if configured:
            message = (
                f"AI assistant is ready ({settings.OPENAI_MODEL}). "
                "If OpenAI is unreachable (quota/network), local guidance mode is used."
            )
        else:
            message = (
                "OpenAI API key is not set — using local guidance mode. "
                "Add OPENAI_API_KEY in backend/.env for full AI replies."
            )
        return AssistantStatusResponse(
            configured=configured,
            model=settings.OPENAI_MODEL if configured else None,
            mode=mode,
            message=message,
        )

    def create_conversation(
        self,
        db: Session,
        *,
        user: User,
        data: ConversationCreate,
    ) -> ConversationResponse:
        mode = _assistant_mode(user)
        candidate_id = data.candidate_id
        job_id = data.job_id
        application_id = data.application_id

        if mode == "candidate":
            # Candidates always chat in their own profile context.
            mine = candidate_crud.get_by_user_id(db, user.id)
            if mine is None:
                raise NotFoundError("Candidate profile not found")
            candidate_id = mine.id
            # Ignore staff-only context overrides from the client.
            job_id = None
            application_id = None
        else:
            if job_id and job_crud.get(db, job_id) is None:
                raise NotFoundError("Job not found")
            if candidate_id and candidate_crud.get(db, candidate_id) is None:
                raise NotFoundError("Candidate not found")
            if application_id and application_crud.get(db, application_id) is None:
                raise NotFoundError("Application not found")

        title = (data.title or "New chat").strip() or "New chat"
        created = assistant_crud.create_conversation(
            db,
            created_by_user_id=user.id,
            title=title,
            candidate_id=candidate_id,
            job_id=job_id,
            application_id=application_id,
        )
        assistant_crud.add_message(
            db,
            conversation_id=created.id,
            role=ChatRole.ASSISTANT,
            content=_welcome_content(mode),
            meta={
                "kind": "welcome",
                "follow_ups": _default_follow_ups(mode),
            },
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
        if user is not None and obj.created_by_user_id != user.id:
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
        if user is not None and conversation.created_by_user_id != user.id:
            raise NotFoundError("Conversation not found")

        content = data.content.strip()
        if not content:
            raise AppException(
                "Message cannot be empty", status_code=400, code="empty_message"
            )

        mode = _assistant_mode(user)
        _ensure_ai_allowed(db, user)

        # Keep candidate chats bound to their profile.
        if (
            mode == "candidate"
            and user is not None
            and conversation.candidate_id is None
        ):
            mine = candidate_crud.get_by_user_id(db, user.id)
            if mine is not None:
                conversation.candidate_id = mine.id
                conversation.updated_at = datetime.now(timezone.utc)
                db.add(conversation)
                db.commit()

        user_msg = assistant_crud.add_message(
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
        if history and history[-1]["content"] == content:
            history = history[:-1]

        context = _build_context(db, conversation, mode=mode)
        try:
            llm = run_recruitment_assistant(
                mode=mode,
                context_block=context,
                history=history,
                user_message=content,
            )
        except AppException:
            assistant_crud.delete_message(db, user_msg.id)
            raise
        except Exception as exc:  # noqa: BLE001
            assistant_crud.delete_message(db, user_msg.id)
            raise AppException(
                "The AI assistant failed unexpectedly. Please try again.",
                status_code=502,
                code="openai_assistant_failed",
                details=str(exc),
            ) from exc

        action_result = None
        meta: dict[str, Any] = {"follow_ups": llm.follow_ups}
        if getattr(llm, "used_fallback", False):
            meta["fallback"] = True
            meta["provider"] = "local"
        else:
            meta["provider"] = "openai"
        if llm.action and mode in {"recruiter", "admin"}:
            meta["proposed_action"] = llm.action
            action_result = _execute_schedule_action(
                db,
                conversation=conversation,
                action=llm.action,
                user=user,
            )
            meta["action_result"] = action_result
            if action_result and action_result.get("ok"):
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
            meta=meta,
        )

        refreshed = assistant_crud.get_conversation(db, conversation.id)
        assert refreshed is not None
        return ChatReplyResponse(
            conversation=_conv_to_response(refreshed),
            reply=_msg_to_response(assistant_msg),
            action_result=action_result,
            follow_ups=llm.follow_ups,
        )


assistant_service = AssistantService()
