"""OpenAI recruitment assistant (role-aware Q&A with local fallback)."""

from __future__ import annotations

import json
import re
from typing import Any, Literal

from openai import APIConnectionError, AuthenticationError, OpenAI, RateLimitError
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.ai.hirepulse_product_guide import (
    detect_product_topic,
    product_fallback_reply,
    product_guide_for_mode,
)

logger = get_logger(__name__)

AssistantMode = Literal["candidate", "recruiter", "admin"]

_PRODUCT_BEHAVIOR = """
HirePulse website questions:
- When the user asks how HirePulse works or where to find a page, explain the feature with
  concrete steps and routes from product knowledge — not generic AI advice.
- Maintain conversation context across turns.

ONE-TURN ACTION POLICY (critical — fixes double-asking):
- When the user asks you to do work (review resume, ATS tips, draft JD, compare candidates,
  interview prep, career advice, schedule interview), DO THE WORK in this reply.
- Do NOT ask “Would you like me to…?”, “Should I…?”, or “Which focus first?” before delivering.
- Do NOT wait for a second confirmation message. Deliver the full answer now using CONTEXT.
- If several options exist, pick the best one from CONTEXT, explain why, and put alternatives
  in follow_ups — do not stall for a choice.
- Only ask a clarifying question when a required fact is missing AND cannot be inferred from
  CONTEXT or chat history. Ask at most ONE specific question, and still give partial value.
- If CONTEXT has a resume/profile/job, use it immediately without asking the user to restate it.
"""

CANDIDATE_SYSTEM_PROMPT = """You are HirePulse Career Coach for job candidates on the HirePulse platform.
Help with:
1) Resume review — structure, wording, impact bullets, gaps, using profile/resume context.
2) ATS improvement — keywords from target roles / OPEN JOBS, formatting tips, section order.
3) Career guidance — skill gaps, growth paths, positioning for preferred roles.
4) Interview preparation — common questions, STAR answers, role-specific tips.
5) HirePulse product help — explain portal features and how to use them.

Return ONLY valid JSON:
{
  "reply": string,
  "follow_ups": string[]  // 2-4 short follow-up questions the user might ask next
}

Formatting rules for "reply" (Markdown):
- Start with a one-sentence overview.
- Use ## section headings for each topic (e.g. ## Quick wins, ## ATS keywords, ## Next steps).
- Use bullet lists (-) or numbered lists (1.) for actionable tips.
- Bold key terms with **like this**.
- Keep sections short (2-5 bullets each). Prefer scannable structure over long paragraphs.
- End with a ## Next steps section when giving advice.

Naming rules (critical):
- Always refer to people as **Candidate Name**, employers as **Company Name**, and roles as **Job Title**.
- Prefer the combined form **Company Name - Job Title** (e.g. TCS - Data Analyst).
- Never mention database IDs, UUIDs, or fields like candidate_id, job_id, application_id, resume_id, company_id.
- Never quote or paraphrase the ACTION REFERENCE section.

Content rules:
- Be specific, actionable, and encouraging. Prefer concrete bullet tips over vague advice.
- Use only facts from CONTEXT and HirePulse product knowledge. If resume/profile data is missing, say what is missing AFTER giving best-effort advice from what you have.
- Never invent employers, degrees, or skills not in CONTEXT.
- For job recommendations, cite Company Name - Job Title from OPEN JOBS and explain fit briefly.
- Keep reply under ~450 words unless the user asks for more depth.
- Always include 2-4 follow_ups that continue the conversation naturally.
- Never schedule interviews; candidates cannot book interviews through this chat.
- Prefer completing the request over asking clarifying questions.
""" + _PRODUCT_BEHAVIOR

RECRUITER_SYSTEM_PROMPT = """You are HirePulse Recruitment Assistant for recruiters and hiring managers.
Help with:
1) Hiring suggestions — sourcing criteria, screening questions, pipeline advice from CONTEXT.
2) Candidate comparison — compare candidates/applicants using CANDIDATE PROFILE / JOB APPLICANTS.
3) Job description generation — draft or improve JDs from FOCUSED JOB / OPEN JOBS / user brief.
4) Role explanation, fit discussion, and interview scheduling when details are available.
5) HirePulse product help — explain staff features and workflows on the website.

Return ONLY valid JSON:
{
  "reply": string,
  "follow_ups": string[],  // 2-4 short follow-up questions
  "action": null | {
    "type": "schedule_interview",
    "application_id": string|null,
    "scheduled_at": string|null (ISO-8601),
    "interview_type": "phone"|"video"|"onsite",
    "duration_minutes": number,
    "meeting_link": string|null,
    "location": string|null
  }
}

Formatting rules for "reply" (Markdown):
- Start with a one-sentence overview.
- Use ## section headings (e.g. ## Recommendation, ## Comparison, ## Screening questions).
- Use bullet or numbered lists for criteria, steps, and requirements.
- Bold important names/scores with **like this**.
- For JD drafts, use ## Summary, ## Responsibilities, ## Requirements, ## Nice to have.
- Keep sections scannable; avoid dense paragraphs.

Naming rules (critical):
- Always use **Candidate Name**, **Company Name**, and **Job Title** (format: Company Name - Job Title).
- Never put database IDs or UUIDs in reply or follow_ups.
- Never mention candidate_id, job_id, application_id, resume_id, or company_id in user-facing text.
- Never quote ACTION REFERENCE. Use it only to fill action.application_id when scheduling.

Content rules:
- Be concise, professional, and accurate. Use only facts from CONTEXT and HirePulse product knowledge.
- Prefer completing the request in one reply. Only ask a clarifying question when blocked.
- For comparisons, use structured criteria (skills, experience, match_score) from CONTEXT and name candidates.
- For JD generation, produce ready-to-use sections (summary, responsibilities, requirements) immediately.
- For schedule_interview: only set action when the user clearly wants to schedule AND you have
  application_id from ACTION REFERENCE plus scheduled_at. In reply, refer to the candidate and job by name.
- If scheduling is requested but details are missing, give a short checklist of what's needed AND
  draft the interview plan; set action=null only when application_id or scheduled_at is truly missing.
- Never invent job requirements or company policies not in CONTEXT.
- Always include 2-4 follow_ups.
""" + _PRODUCT_BEHAVIOR

ADMIN_SYSTEM_PROMPT = """You are HirePulse Platform Insights Assistant for administrators.
Help with:
1) Analytics interpretation — KPIs, funnel, match scores, hiring velocity from PLATFORM ANALYTICS.
2) Platform insights — open jobs health, recruiter/job performance, interview outcomes.
3) Operational recommendations grounded in the provided metrics (not generic advice).
4) When staff context is present: hiring suggestions, candidate comparison, and job description drafting.
5) Scheduling interviews when the user clearly asks and enough details are available.
6) HirePulse product help — explain admin and staff website features.

Return ONLY valid JSON:
{
  "reply": string,
  "follow_ups": string[],  // 2-4 short follow-up questions
  "action": null | {
    "type": "schedule_interview",
    "application_id": string|null,
    "scheduled_at": string|null (ISO-8601),
    "interview_type": "phone"|"video"|"onsite",
    "duration_minutes": number,
    "meeting_link": string|null,
    "location": string|null
  }
}

Formatting rules for "reply" (Markdown):
- Start with a one-sentence overview.
- Use ## section headings (e.g. ## Snapshot, ## Risks, ## Recommended actions).
- Present metrics as bullets with **bold labels**.
- Prefer short, scannable sections over long prose.

Naming rules (critical):
- Always use **Candidate Name**, **Company Name**, and **Job Title** (format: Company Name - Job Title).
- Never put database IDs or UUIDs in reply or follow_ups.
- Never mention candidate_id, job_id, application_id, resume_id, or company_id in user-facing text.
- Never quote ACTION REFERENCE. Use it only to fill action.application_id when scheduling.

Content rules:
- Be concise, data-driven, and actionable. Cite numbers from CONTEXT when available.
- Prefer completing the request in one reply using available metrics; do not ask for confirmation first.
- Use only facts from CONTEXT and HirePulse product knowledge. If analytics are missing, say so and still give the best operational guidance you can.
- Never invent metrics, user counts, or revenue figures.
- For schedule_interview: only set action when the user clearly wants to schedule AND you have
  application_id from ACTION REFERENCE plus scheduled_at. Name people and jobs in the reply.
- Keep reply under ~450 words unless asked for more depth.
- Always include 2-4 follow_ups.
""" + _PRODUCT_BEHAVIOR


_UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.I,
)
_ID_FIELD_RE = re.compile(
    r"\b(?:application_id|candidate_id|job_id|resume_id|company_id|created_by_user_id)\s*[:=]\s*\S+",
    re.I,
)
_BARE_ID_PREFIX_RE = re.compile(r"\bid\s*[:=]\s*[0-9a-f-]{36}\b", re.I)
_ARROW_ID_RE = re.compile(r"\s*=>\s*[0-9a-f-]{36}\b", re.I)


def scrub_user_facing_text(text: str) -> str:
    """Remove database IDs / UUID noise from text shown to users."""
    if not text:
        return text
    cleaned = _ID_FIELD_RE.sub("", text)
    cleaned = _BARE_ID_PREFIX_RE.sub("", cleaned)
    cleaned = _ARROW_ID_RE.sub("", cleaned)
    cleaned = _UUID_RE.sub("", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" ?\| ?", " | ", cleaned)
    cleaned = re.sub(r"(?:\s*\|\s*){2,}", " | ", cleaned)
    cleaned = re.sub(r"^\s*\|\s*", "", cleaned, flags=re.M)
    cleaned = re.sub(r"\s*\|\s*$", "", cleaned, flags=re.M)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _humanize_context_line(line: str) -> str:
    """Strip machine keys from a context line before dumping into local replies."""
    text = scrub_user_facing_text(line)
    text = re.sub(r"\bcandidate_name\s*=\s*", "", text, flags=re.I)
    text = re.sub(r"\bcompany_name\s*=\s*", "", text, flags=re.I)
    text = re.sub(r"\bjob_title\s*=\s*", "", text, flags=re.I)
    text = re.sub(r"\bdisplay\s*=\s*", "", text, flags=re.I)
    return text.strip(" -•|\t")


def _friendly_lines(text: str, n: int = 8) -> list[str]:
    lines = [_humanize_context_line(ln) for ln in (text or "").splitlines() if ln.strip()]
    return [ln for ln in lines if ln and not ln.upper().startswith("ACTION REFERENCE")][:n]


class AssistantLLMResult(BaseModel):
    reply: str
    follow_ups: list[str] = Field(default_factory=list)
    action: dict[str, Any] | None = None
    used_fallback: bool = False


def _normalize_follow_ups(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    items: list[str] = []
    for entry in raw:
        text = str(entry or "").strip()
        if text and text not in items:
            items.append(text[:160])
        if len(items) >= 4:
            break
    return items


def _system_prompt_for(mode: AssistantMode) -> str:
    base = (
        CANDIDATE_SYSTEM_PROMPT
        if mode == "candidate"
        else ADMIN_SYSTEM_PROMPT
        if mode == "admin"
        else RECRUITER_SYSTEM_PROMPT
    )
    return f"{base}\n\n{product_guide_for_mode(mode)}"


def require_openai_configured() -> None:
    if not settings.openai_configured:
        raise AppException(
            "OpenAI is not configured. Set OPENAI_API_KEY in the backend .env file "
            "and restart the API server.",
            status_code=503,
            code="openai_not_configured",
        )


def _section(context_block: str, heading: str, *, max_chars: int = 1200) -> str:
    pattern = re.compile(
        rf"(?im)^\s*{re.escape(heading)}\s*$([\s\S]*?)(?=^\s*[A-Z][A-Z0-9 /_-]{{2,}}\s*$|\Z)"
    )
    match = pattern.search(context_block or "")
    if not match:
        # Fallback: find heading inline then take following lines.
        idx = (context_block or "").upper().find(heading.upper())
        if idx < 0:
            return ""
        chunk = (context_block or "")[idx : idx + max_chars]
        return chunk.strip()
    return (match.group(1) or "").strip()[:max_chars]


def _first_lines(text: str, n: int = 8) -> list[str]:
    lines = [ln.strip(" -•\t") for ln in (text or "").splitlines() if ln.strip()]
    return lines[:n]


def _wants(message: str, *keywords: str) -> bool:
    lower = message.lower()
    return any(k in lower for k in keywords)


def _fallback_note() -> str:
    return (
        "\n\n---\n"
        "*Local guidance mode: OpenAI is temporarily unavailable "
        "(often billing/quota). Replies use your HirePulse context only.*"
    )


def fallback_recruitment_assistant(
    *,
    mode: AssistantMode,
    context_block: str,
    history: list[dict[str, str]],
    user_message: str,
) -> AssistantLLMResult:
    """Context-aware local reply when OpenAI is unavailable."""
    ctx = context_block or ""
    msg = (user_message or "").strip()

    # Prefer HirePulse product answers for website / how-to questions
    product_topic = detect_product_topic(msg)
    if product_topic:
        # Light conversation continuity from prior user turns
        prior_user = [
            (h.get("content") or "").strip()
            for h in (history or [])
            if (h.get("role") == "user" and (h.get("content") or "").strip())
        ]
        reply, follow_ups = product_fallback_reply(mode, product_topic)
        if prior_user:
            reply += (
                "\n\n## Continuing this chat\n"
                "- I still have your earlier questions in this conversation — "
                "ask a follow-up anytime."
            )
        return AssistantLLMResult(
            reply=reply + _fallback_note(),
            follow_ups=follow_ups,
            action=None,
            used_fallback=True,
        )

    profile = _section(ctx, "CANDIDATE PROFILE") or _section(ctx, "PROFILE")
    resume = _section(ctx, "RESUME") or _section(ctx, "PARSED RESUME")
    jobs = _section(ctx, "OPEN JOBS") or _section(ctx, "JOBS")
    focused_job = _section(ctx, "FOCUSED JOB") or _section(ctx, "JOB")
    applicants = _section(ctx, "JOB APPLICANTS") or _section(ctx, "APPLICANTS")
    analytics = _section(ctx, "PLATFORM ANALYTICS") or _section(ctx, "ANALYTICS")

    skills_blob = " ".join([profile, resume])
    skills = sorted(
        {
            m.group(0)
            for m in re.finditer(
                r"\b(?:Python|Java|JavaScript|TypeScript|React|Node\.?js|FastAPI|"
                r"Django|Flask|SQL|PostgreSQL|MySQL|MongoDB|AWS|Azure|GCP|Docker|"
                r"Kubernetes|Git|HTML|CSS|Next\.?js|Tailwind|Redis|GraphQL|"
                r"Machine Learning|NLP|Excel|Communication|Leadership)\b",
                skills_blob,
                flags=re.I,
            )
        },
        key=str.lower,
    )

    if mode == "candidate":
        if _wants(msg, "resume", "cv", "ats", "keyword"):
            skill_line = (
                f"**Detected skills:** {', '.join(skills[:10])}"
                if skills
                else "**Detected skills:** none yet — upload/parse a resume first."
            )
            reply = (
                "Here is a practical ATS-focused resume pass based on your HirePulse data.\n\n"
                "## Snapshot\n"
                f"- {skill_line}\n"
                f"- **Profile/resume context:** {'available' if (profile or resume) else 'limited'}\n\n"
                "## Quick wins\n"
                "- Put a **Skills** section near the top and mirror wording from target jobs.\n"
                "- Rewrite bullets as: **action + tool/skill + measurable outcome**.\n"
                "- Keep one clear target title; avoid dense tables or multi-column layouts.\n"
                "- Add missing keywords from open jobs only when they match real experience.\n\n"
                "## Next steps\n"
                "1. Pick one target job.\n"
                "2. Align your top 8 skills to that JD.\n"
                "3. Ask me to rewrite your strongest recent role bullets."
            )
            if jobs:
                sample = "\n".join(f"- {line}" for line in _friendly_lines(jobs, 3))
                reply += f"\n\n## Open roles to align with\n{sample}"
            follow_ups = [
                "Which job should I optimize my resume for?",
                "What skills am I missing for that role?",
                "Give me stronger bullet points for my latest role",
            ]
        elif _wants(msg, "interview", "prepare", "star"):
            skill_bits = f" ({', '.join(skills[:5])})" if skills else ""
            reply = (
                "Here is a structured interview prep plan using your profile context.\n\n"
                "## Prepare 3 STAR stories\n"
                "- **Impact project** — problem, your actions, measurable result.\n"
                "- **Collaboration/conflict** — how you aligned stakeholders.\n"
                "- **Technical challenge** — diagnosis, fix, and what you learned.\n\n"
                "## Practice focus\n"
                f"- Explain your top skills{skill_bits} with concrete examples.\n"
                "- Tie answers to outcomes from your preferred / open jobs context.\n\n"
                "## Closing questions\n"
                "1. What does success look like in the first 90 days?\n"
                "2. Which team metrics matter most for this role?\n\n"
                "## Next steps\n"
                "- Pick one skill and ask me to draft a STAR answer for it."
            )
            follow_ups = [
                "Draft STAR answers for my top skills",
                "What questions should I ask the interviewer?",
                "How do I explain a career gap?",
            ]
        elif _wants(msg, "job", "role", "opening", "apply", "career"):
            if jobs:
                listed = "\n".join(f"- {line}" for line in _friendly_lines(jobs, 6))
                reply = (
                    "Based on **OPEN JOBS** in your context, start with these roles.\n\n"
                    f"## Suggested roles\n{listed}\n\n"
                    "## How to choose\n"
                    "- Prioritize roles that overlap with your current skills.\n"
                    "- Then tailor resume keywords to that one job description.\n\n"
                    "## Next steps\n"
                    "1. Pick one target role.\n"
                    "2. Ask me which skills to emphasize.\n"
                    "3. Ask for an application summary draft."
                )
            else:
                skill_bits = f" ({', '.join(skills[:6])})" if skills else ""
                reply = (
                    "I do not see open jobs in context yet.\n\n"
                    "## What to do\n"
                    "- Browse **Jobs** in HirePulse.\n"
                    f"- Then ask which openings fit your skills{skill_bits}.\n\n"
                    "## Next steps\n"
                    "- Come back with a target job title and I will tailor advice."
                )
            follow_ups = [
                "Which of these jobs fits me best?",
                "What skills should I learn next?",
                "Help me write an application summary",
            ]
        else:
            skill_line = (
                f"**Skills in context:** {', '.join(skills[:10])}"
                if skills
                else "**Skills in context:** limited — I'll still give practical next steps."
            )
            reply = (
                "Here is useful guidance from your HirePulse context — no need to choose a "
                "focus first.\n\n"
                "## Snapshot\n"
                f"- {skill_line}\n"
                f"- **Profile/resume:** {'available' if (profile or resume) else 'limited'}\n"
                f"- **Open jobs in context:** {'yes' if jobs else 'not loaded'}\n\n"
                "## Immediate actions\n"
                "- **Resume/ATS:** Put a clear Skills section near the top; rewrite bullets as "
                "action + tool + result.\n"
                "- **Jobs:** Align your top skills to one target role from open jobs.\n"
                "- **Interviews:** Prepare 3 STAR stories (impact, conflict, technical).\n\n"
                "## Next steps\n"
                "1. Ask me to review your resume in depth.\n"
                "2. Or ask which open job fits you best.\n"
                "3. Or ask for STAR answers for a specific skill."
            )
            follow_ups = [
                "Review my resume for ATS",
                "Suggest jobs that fit my skills",
                "Help me prepare for interviews",
            ]

    elif mode == "admin":
        if analytics or _wants(msg, "analytic", "kpi", "funnel", "insight", "metric"):
            lines = _friendly_lines(analytics or ctx, 10)
            body = "\n".join(f"- {ln}" for ln in lines) if lines else "- No analytics block found in context."
            reply = (
                "Here is a platform snapshot from the available analytics context.\n\n"
                f"## Snapshot\n{body}\n\n"
                "## Recommended focus\n"
                "- Improve conversion where the funnel drops most.\n"
                "- Prioritize jobs with high applicant volume but low interview rates.\n\n"
                "## Next steps\n"
                "1. Identify the weakest funnel stage.\n"
                "2. Review top open jobs needing attention.\n"
                "3. Ask for a hiring-ops checklist."
            )
            follow_ups = [
                "Where is the funnel dropping?",
                "Which jobs need attention?",
                "Summarize hiring velocity this period",
            ]
        else:
            reply = (
                "I can interpret platform analytics, open-job health, and hiring ops "
                "from the CONTEXT block.\n\n"
                "## Ask me about\n"
                "- KPIs and funnel health\n"
                "- Jobs that need attention\n"
                "- Recruiter / ops recommendations"
            )
            follow_ups = [
                "Summarize platform analytics",
                "Which recruiters need support?",
                "Draft a hiring ops checklist",
            ]

    else:  # recruiter
        if _wants(msg, "job description", "jd", "write a job", "draft a job", "generate"):
            title = _friendly_lines(focused_job or jobs, 1)
            role = title[0] if title else "the role"
            # Prefer display / company - title style lines when present
            if "company_name=" in (focused_job or "") or "job_title=" in (focused_job or ""):
                company_m = re.search(r"company_name=([^\n]+)", focused_job or "", re.I)
                title_m = re.search(r"job_title=([^\n]+)", focused_job or "", re.I)
                company = (company_m.group(1).strip() if company_m else "").strip()
                job_title = (title_m.group(1).strip() if title_m else "").strip()
                if company and company.lower() != "n/a" and job_title:
                    role = f"{company} - {job_title}"
                elif job_title:
                    role = job_title
            reply = (
                f"Draft job description for **{role}**.\n\n"
                "## Summary\n"
                f"We are hiring for {role}. Use the focused job / open jobs context "
                "to finalize company specifics.\n\n"
                "## Responsibilities\n"
                "- Deliver core outcomes for the team's roadmap\n"
                "- Collaborate with cross-functional partners\n"
                "- Own quality, documentation, and continuous improvement\n\n"
                "## Requirements\n"
                "- Relevant experience for the seniority of this role\n"
                "- Strong communication and ownership\n"
                "- Tools/skills listed in the job context above\n\n"
                "## Next steps\n"
                "Reply with seniority, must-have skills, and location to refine this draft."
            )
            follow_ups = [
                "Make this JD more senior",
                "Add must-have vs nice-to-have skills",
                "Shorten this for a LinkedIn post",
            ]
        elif _wants(msg, "compare", "vs", "versus", "who is better", "best candidate"):
            lines = _friendly_lines(applicants or profile, 8)
            if lines:
                body = "\n".join(f"- {ln}" for ln in lines)
                reply = (
                    "Candidate comparison from available context.\n\n"
                    f"## Candidates in context\n{body}\n\n"
                    "## Ranking approach\n"
                    "1. Rank by **match_score** / skills overlap.\n"
                    "2. Interview for communication and ownership.\n"
                    "3. Select one finalist and build a scorecard.\n\n"
                    "## Next steps\n"
                    "- Tell me which candidate to prioritize and I will suggest screening questions."
                )
            else:
                reply = (
                    "I do not have applicant/candidate comparison data in context.\n\n"
                    "## What to do\n"
                    "- Select a job (and candidates) in the assistant controls.\n"
                    "- Then ask me to compare again."
                )
            follow_ups = [
                "Suggest screening questions",
                "Who should I interview first?",
                "What skills are commonly missing?",
            ]
        elif _wants(msg, "schedule", "interview", "book"):
            reply = (
                "I can schedule an interview when these details are available.\n\n"
                "## Required details\n"
                "1. Candidate name and job (Company Name - Job Title)\n"
                "2. Date and time (with timezone)\n"
                "3. Interview type (**phone** / **video** / **onsite**)\n\n"
                "## Example\n"
                "> Schedule a 45-minute video interview for Priya Sharma for "
                "TCS - Data Analyst on 2026-08-01 15:00 IST\n\n"
                "## Next steps\n"
                "- Send the details above and I will prepare the schedule action."
            )
            follow_ups = [
                "What details do you need to schedule?",
                "Draft an interview invite message",
                "Suggest a screening scorecard",
            ]
        else:
            reply = (
                "Local hiring assistant is active. I can help using the job/candidate "
                "context attached to this chat.\n\n"
                "## Context available\n"
                f"- **Focused job:** {'yes' if focused_job else 'no'}\n"
                f"- **Applicants/profile:** {'yes' if (applicants or profile) else 'no'}\n\n"
                "## I can help with\n"
                "1. Drafting a job description\n"
                "2. Comparing candidates\n"
                "3. Screening questions / interview scheduling"
            )
            follow_ups = [
                "Draft a job description",
                "Compare candidates for this job",
                "Suggest screening questions",
            ]

    return AssistantLLMResult(
        reply=scrub_user_facing_text((reply + _fallback_note()).strip()),
        follow_ups=[
            scrub_user_facing_text(item) for item in _normalize_follow_ups(follow_ups)
        ],
        action=None,
        used_fallback=True,
    )


def _openai_failure_message(exc: Exception) -> tuple[str, str, int]:
    """Return (message, code, status) for OpenAI failures."""
    if isinstance(exc, AuthenticationError):
        return (
            "OpenAI rejected the API key. Update OPENAI_API_KEY in backend/.env "
            "and restart the API.",
            "openai_auth_failed",
            502,
        )
    if isinstance(exc, RateLimitError):
        detail = str(exc).lower()
        if "insufficient_quota" in detail or "quota" in detail:
            return (
                "OpenAI quota is exhausted. Add billing/credits at platform.openai.com, "
                "or continue with local guidance mode.",
                "openai_quota_exceeded",
                502,
            )
        return (
            "OpenAI rate limit hit. Wait a moment and try again.",
            "openai_rate_limited",
            429,
        )
    if isinstance(exc, APIConnectionError):
        return (
            "Could not connect to OpenAI. Check your network and try again.",
            "openai_unreachable",
            502,
        )
    return (
        "The AI assistant could not reach OpenAI. Check your API key and try again.",
        "openai_assistant_failed",
        502,
    )


def run_recruitment_assistant(
    *,
    mode: AssistantMode,
    context_block: str,
    history: list[dict[str, str]],
    user_message: str,
    allow_fallback: bool = True,
) -> AssistantLLMResult:
    """Score reply via OpenAI when possible; otherwise use local guidance."""
    if settings.openai_configured:
        messages: list[dict[str, str]] = [
            {"role": "system", "content": _system_prompt_for(mode)},
            {
                "role": "system",
                "content": f"MODE: {mode}\nCONTEXT:\n{context_block}",
            },
            {
                "role": "system",
                "content": (
                    "Execute the user's latest request fully in this turn. "
                    "Do not ask for confirmation before delivering. "
                    "Use CONTEXT and chat history. Ask at most one clarifying question, "
                    "and only if you cannot proceed without it."
                ),
            },
        ]
        for item in history[-30:]:
            role = item.get("role") or "user"
            if role not in {"user", "assistant"}:
                role = "user"
            messages.append({"role": role, "content": item.get("content") or ""})
        messages.append({"role": "user", "content": user_message})

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        try:
            completion = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                temperature=0.3,
                response_format={"type": "json_object"},
                messages=messages,
            )
            content = completion.choices[0].message.content or "{}"
            try:
                payload = json.loads(content)
            except json.JSONDecodeError as exc:
                if allow_fallback:
                    logger.warning("Assistant returned invalid JSON; using fallback")
                    return fallback_recruitment_assistant(
                        mode=mode,
                        context_block=context_block,
                        history=history,
                        user_message=user_message,
                    )
                raise AppException(
                    "The AI assistant returned an invalid response. Please try again.",
                    status_code=502,
                    code="openai_invalid_json",
                    details=content[:500],
                ) from exc

            reply = str(payload.get("reply") or "").strip()
            if not reply:
                if allow_fallback:
                    return fallback_recruitment_assistant(
                        mode=mode,
                        context_block=context_block,
                        history=history,
                        user_message=user_message,
                    )
                raise AppException(
                    "Assistant returned an empty reply. Please try again.",
                    status_code=502,
                    code="openai_empty_reply",
                )

            follow_ups = [
                scrub_user_facing_text(item)
                for item in _normalize_follow_ups(payload.get("follow_ups"))
            ]
            action = payload.get("action")
            if mode == "candidate":
                action = None
            elif action is not None and not isinstance(action, dict):
                action = None

            return AssistantLLMResult(
                reply=scrub_user_facing_text(reply),
                follow_ups=follow_ups,
                action=action,
                used_fallback=False,
            )
        except AppException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Recruitment assistant OpenAI call failed: %s", exc)
            if allow_fallback:
                return fallback_recruitment_assistant(
                    mode=mode,
                    context_block=context_block,
                    history=history,
                    user_message=user_message,
                )
            message, code, status = _openai_failure_message(exc)
            raise AppException(
                message,
                status_code=status,
                code=code,
                details=str(exc),
            ) from exc

    if allow_fallback:
        return fallback_recruitment_assistant(
            mode=mode,
            context_block=context_block,
            history=history,
            user_message=user_message,
        )

    require_openai_configured()
    raise AppException(
        "OpenAI is not configured.",
        status_code=503,
        code="openai_not_configured",
    )
