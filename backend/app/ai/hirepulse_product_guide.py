"""HirePulse product knowledge for the AI Assistant.

Injected into system prompts and CONTEXT so the assistant explains
platform features instead of giving generic chatbot answers.
"""

from __future__ import annotations

from typing import Literal

AssistantMode = Literal["candidate", "recruiter", "admin"]

HIREPULSE_PRODUCT_OVERVIEW = """
## HirePulse product knowledge (use this for website / how-to questions)

HirePulse is an AI recruitment platform covering the full hiring loop: profiles & resumes,
jobs & companies, applications, AI screening / ATS scoring, interviews, notifications,
analytics, and this Assistant. When users ask how something works on the site, explain the
HirePulse feature and where to find it. Do not give generic ChatGPT-style answers about
unrelated products.

Always maintain conversation context: remember earlier messages in this chat.

### Shared concepts (deep knowledge)
- **Resume Upload**: PDF/DOC/DOCX/TXT/RTF up to 10MB. Actions: upload, replace, preview,
  download, delete. Upload stores the file only and never overwrites profile fields
  (name, phone, skills, experience). Text extraction + AI parse run during screening.
- **Resume Screening**: Select a job + resume → compare → get ATS/match score, missing
  skills, strengths, and rewrite suggestions. Staff: `/screening`. Candidates may use
  portal screening when available.
- **ATS Score**: HirePulse fit score between resume and job (skills + experience + JD
  alignment). Visible on screening results and related applications. Coaching tip: mirror
  real skills from the JD; do not invent skills.
- **Jobs**: Title, company, location, employment type, skills, salary range, deadline,
  description. Candidates browse/save/apply. Staff create/edit/close jobs.
- **Applications**: Created when a candidate applies (resume required). Staff review status,
  scores, and move candidates toward interviews.
- **Companies**: Employer profiles (industry, location, open roles). UI uses HirePulse brand
  mark instead of external logos.
- **Interviews**: Phone / video / onsite. Staff schedule from Interviews or via Assistant
  when application + time are known. Candidates learn via notifications.
- **Dashboard**: Role home with activity / hiring overview.
- **Notifications**: Bell + notifications page for applications, interviews, system events.
- **Profile**: Identity, headline, about, experience, education, skills (multi-select with
  Save), resume panel.
- **Settings**: Theme, notification prefs, privacy (AI processing toggle for screening +
  Assistant).
- **Authentication**: `/login`, `/register`. Roles: candidate, recruiter, admin.
- **AI Assistant**: This chat — product help + role coaching/hiring help, with chat history.

### Candidate navigation (portal)
- Dashboard `/portal` · Screening `/portal/screening` · Assistant `/portal/assistant`
- Jobs `/portal/jobs` · Saved Jobs `/portal/saved-jobs` · Notifications `/portal/notifications`
- Profile `/portal/profile` · Settings `/portal/settings`
- Auth `/login`, `/register`
- Account menu: View Profile, Resume, Saved Jobs (with count), Settings, Logout
- On Jobs: Save / Saved bookmark stores the role in the database; manage them on Saved Jobs
  (remove, apply, search, filter by type / applied status).

### Recruiter navigation
- Dashboard `/dashboard` · Jobs `/jobs` · Companies `/companies` · Candidates `/candidates`
- Resumes `/resumes` · Screening `/screening` · Assistant `/assistant`
- Interviews `/interviews` · Analytics `/analytics`
- Notifications `/notifications` · Profile `/profile` · Settings `/settings`

### Admin extras
- Users `/users` · Recruiters `/recruiters` · Reports `/reports` (plus all recruiter areas)

### How to answer product questions
1. Name the HirePulse feature.
2. Say who can use it.
3. Give menu path / URL.
4. Give 2–4 steps.
5. Offer a follow-up tied to this conversation.
""".strip()


def product_guide_for_mode(mode: AssistantMode) -> str:
    """Role-focused product guide appended to system prompts."""
    if mode == "candidate":
        role_focus = """
### Candidate focus
- Upload / replace / download / preview / delete resume on **Profile**.
- Apply from **Jobs** (a resume is required).
- Use **Resume AI Screening** in the portal for personal screening insights when available.
- Manage skills on Profile (searchable multi-select; click Save to persist).
- Toggle AI features under **Settings → Privacy**.
- Ask me how to use any portal page; I will explain HirePulse steps, not generic advice.
""".strip()
    elif mode == "admin":
        role_focus = """
### Admin focus
- Oversee users, recruiters, jobs, companies, resumes, screening, interviews, analytics, reports.
- Explain admin menus and operational workflows in HirePulse terms.
- Use live PLATFORM ANALYTICS when discussing KPIs.
- Help staff with screening, ATS scores, and interview scheduling when context allows.
""".strip()
    else:
        role_focus = """
### Recruiter focus
- Create/manage jobs and companies; upload candidate resumes on **Resumes**.
- Run **Resume Screening** to compare resume ↔ job and read ATS score / gaps / strengths.
- Track applications and schedule **Interviews**.
- Use Dashboard and Analytics for pipeline health.
- Explain HirePulse workflows step-by-step when asked “how do I…”.
""".strip()

    return f"{HIREPULSE_PRODUCT_OVERVIEW}\n\n{role_focus}"


def product_capabilities_block(mode: AssistantMode) -> str:
    """Compact CAPABILITIES block injected into CONTEXT every turn."""
    shared = (
        "PRODUCT HELP (HirePulse website features — prefer these over generic AI advice):\n"
        "- Resume Upload / replace / delete / download / preview\n"
        "- Resume Screening and ATS / match scores\n"
        "- Jobs, Applications, Companies, Interviews\n"
        "- Dashboard, Notifications, Profile, Settings, Authentication\n"
        "- Keep conversation context across turns in this chat\n"
    )
    if mode == "candidate":
        return (
            shared
            + "- Candidate routes: /portal, /portal/jobs, /portal/profile (resume+skills), "
            "/portal/screening, /portal/notifications, /portal/settings, /portal/assistant\n"
            "- Coaching: resume review, ATS tips, interview prep, career guidance, job fit\n"
            "- Always use Company Name - Job Title; never mention database IDs"
        )
    if mode == "admin":
        return (
            shared
            + "- Admin routes include /dashboard, /users, /recruiters, /jobs, /companies, "
            "/resumes, /screening, /interviews, /analytics, /reports, /notifications, "
            "/settings, /assistant\n"
            "- Interpret PLATFORM ANALYTICS; support hiring ops and scheduling when asked\n"
            "- Always use Candidate Name, Company Name, Job Title; never UUIDs"
        )
    return (
        shared
        + "- Recruiter routes: /dashboard, /jobs, /companies, /candidates, /resumes, "
        "/screening, /interviews, /analytics, /notifications, /settings, /assistant\n"
        "- Hiring suggestions, candidate comparison, JD drafts, interview scheduling\n"
        "- Always use Candidate Name, Company Name, Job Title; never UUIDs"
    )


# Keyword groups for local fallback — only clear product/navigation intents
_PRODUCT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "resume_upload": (
        "upload resume",
        "upload cv",
        "resume upload",
        "how do i upload",
        "how to upload",
        "where do i upload",
        "replace resume",
        "delete resume",
        "download resume",
        "preview resume",
    ),
    "screening": (
        "resume screening",
        "ai screening",
        "how do i screen",
        "how to screen",
        "run screening",
        "where is screening",
    ),
    "ats": (
        "what is ats",
        "what's ats",
        "ats score mean",
        "what does ats",
        "explain ats score",
        "where is ats score",
    ),
    "jobs": (
        "how do i apply",
        "how to apply",
        "where do i find jobs",
        "browse jobs",
        "jobs page",
        "open jobs page",
    ),
    "applications": (
        "my applications",
        "applications page",
        "how do applications work",
        "where are applications",
    ),
    "dashboard": (
        "dashboard page",
        "what is the dashboard",
        "where's the dashboard",
        "where is the dashboard",
    ),
    "notifications": (
        "notifications page",
        "where are notifications",
        "how do notifications",
    ),
    "interviews": (
        "interviews page",
        "how do interviews work",
        "where do i schedule interview",
        "schedule an interview on",
    ),
    "companies": (
        "companies page",
        "company profile page",
        "how do companies work",
    ),
    "settings": (
        "settings page",
        "privacy settings",
        "where is settings",
        "ai processing setting",
    ),
    "profile": (
        "edit profile",
        "profile page",
        "where is my profile",
        "how do i update profile",
        "skills section",
    ),
    "auth": (
        "how do i login",
        "how to login",
        "how do i sign up",
        "how to register",
        "forgot password",
    ),
    "assistant": (
        "what can you do",
        "what can the assistant",
        "how does hirepulse work",
        "explain hirepulse",
        "features of hirepulse",
    ),
}


def _has_coaching_intent(message: str) -> bool:
    """True when the user wants advice/work done, not a website how-to."""
    lower = message.lower()
    coaching = (
        "review my",
        "improve my",
        "rewrite",
        "help me prepare",
        "draft",
        "compare",
        "suggest",
        "give me",
        "make my resume",
        "ats-friendly",
        "ats friendly",
        "star answer",
        "career advice",
        "job description",
        "jd for",
        "hiring plan",
        "interview questions",
    )
    return any(p in lower for p in coaching)


def detect_product_topic(message: str) -> str | None:
    lower = (message or "").lower().strip()
    if not lower:
        return None
    # Coaching / do-the-work requests must not be intercepted by product FAQ
    if _has_coaching_intent(lower):
        return None

    for topic, phrases in _PRODUCT_KEYWORDS.items():
        if any(p in lower for p in phrases):
            return topic

    if "resume" in lower and any(
        w in lower for w in ("upload", "replace file", "delete file")
    ):
        return "resume_upload"
    if ("how do i" in lower or "where do i" in lower or "how to" in lower) and any(
        w in lower
        for w in (
            "upload",
            "screen",
            "apply",
            "job",
            "notification",
            "setting",
            "profile",
            "interview",
            "company",
            "dashboard",
            "login",
            "register",
        )
    ):
        # Map generic how-to to the closest topic
        if "upload" in lower or "resume" in lower:
            return "resume_upload"
        if "screen" in lower or "ats" in lower:
            return "screening"
        if "apply" in lower or "job" in lower:
            return "jobs"
        if "interview" in lower:
            return "interviews"
        if "notification" in lower:
            return "notifications"
        if "setting" in lower:
            return "settings"
        if "profile" in lower or "skill" in lower:
            return "profile"
        if "company" in lower:
            return "companies"
        if "dashboard" in lower:
            return "dashboard"
        if "login" in lower or "register" in lower:
            return "auth"
        return "assistant"
    if "hirepulse" in lower and any(
        w in lower for w in ("what is", "explain", "features", "website", "platform")
    ):
        return "assistant"
    return None


def product_fallback_reply(mode: AssistantMode, topic: str) -> tuple[str, list[str]]:
    """Local fallback copy when OpenAI is down but the user asked about HirePulse."""
    is_candidate = mode == "candidate"

    replies: dict[str, tuple[str, list[str]]] = {
        "resume_upload": (
            (
                "Here's how **Resume Upload** works in HirePulse.\n\n"
                "## Where\n"
                f"- {'**Profile** (`/portal/profile`)' if is_candidate else '**Resumes** (`/resumes`) or the candidate Profile panel'}\n\n"
                "## What you can do\n"
                "- Upload or replace PDF, DOC, DOCX, TXT, or RTF (max 10MB)\n"
                "- Preview, download, or delete the file\n"
                "- Upload **stores the file only** — it does not overwrite your profile fields\n"
                "- AI parsing for matching runs later during **Resume Screening**\n\n"
                "## Next steps\n"
                "1. Open Profile / Resumes.\n"
                "2. Choose Upload or Replace.\n"
                "3. Click Save only if you also changed profile fields (skills, etc.)."
            ),
            [
                "How does Resume Screening work?",
                "Does uploading change my profile?",
                "How do I apply to a job?",
            ],
        ),
        "screening": (
            (
                "Here's how **Resume Screening** works in HirePulse.\n\n"
                "## Where\n"
                f"- {'**Resume AI Screening** (`/portal/screening`)' if is_candidate else '**Resume Screening** (`/screening`)'}\n\n"
                "## What it does\n"
                "- Compares a resume to a job description\n"
                "- Produces an **ATS / match score**, missing skills, strengths, and suggestions\n"
                "- Parsing runs here (not on upload)\n\n"
                "## Next steps\n"
                "1. Open Resume Screening.\n"
                "2. Select a job and resume.\n"
                "3. Run the comparison and review the score breakdown."
            ),
            [
                "What is an ATS score?",
                "How do I upload a resume?",
                "How do applications work?",
            ],
        ),
        "ats": (
            (
                "In HirePulse, the **ATS / match score** measures how well a resume fits a job.\n\n"
                "## What it reflects\n"
                "- Skills overlap with the job\n"
                "- Experience and role alignment\n"
                "- Gaps the candidate may need to address\n\n"
                "## Where you see it\n"
                "- Resume Screening results\n"
                "- Application / screening history when a match has been run\n\n"
                "## Tip\n"
                "Improve scores by aligning Profile skills and resume wording with the target job "
                "(only claim skills you actually have)."
            ),
            [
                "How do I run Resume Screening?",
                "Help me improve my resume for ATS",
                "Where do I manage skills?",
            ],
        ),
        "jobs": (
            (
                "Here's how **Jobs** work in HirePulse.\n\n"
                "## Where\n"
                f"- {'**Jobs** (`/portal/jobs`) — browse, save, and apply' if is_candidate else '**Jobs** (`/jobs`) — create and manage openings'}\n\n"
                "## Details\n"
                "- Each job shows company, location, type, skills, salary, and deadlines\n"
                "- Candidates need an uploaded resume before applying\n"
                "- Staff attach jobs to companies and track applicants\n\n"
                "## Next steps\n"
                f"- Open the Jobs page and {'pick a role to apply' if is_candidate else 'create or edit an opening'}."
            ),
            [
                "How do applications work?",
                "How do I upload a resume?",
                "Explain companies in HirePulse",
            ],
        ),
        "applications": (
            (
                "Here's how **Applications** work in HirePulse.\n\n"
                "## Candidates\n"
                "- Apply from a job page after uploading a resume\n"
                "- Track status through notifications and screening history\n\n"
                "## Staff\n"
                "- Review applicants on the job / candidates / screening flows\n"
                "- Run screening for ATS scores and schedule interviews\n\n"
                "## Next steps\n"
                "- Tell me whether you are applying or reviewing applicants."
            ),
            [
                "How do I apply to a job?",
                "How does Resume Screening work?",
                "How do interviews work?",
            ],
        ),
        "dashboard": (
            (
                "The **Dashboard** is your HirePulse home overview.\n\n"
                "## Where\n"
                f"- {'`/portal`' if is_candidate else '`/dashboard`'}\n\n"
                "## What you see\n"
                "- Activity and hiring / job highlights for your role\n"
                "- Shortcuts into jobs, screening, and other modules\n\n"
                "## Next steps\n"
                "- Open Dashboard, then jump to the module you need from the sidebar."
            ),
            [
                "What can the AI Assistant do?",
                "Where are notifications?",
                "How do I open Jobs?",
            ],
        ),
        "notifications": (
            (
                "**Notifications** keep you updated on HirePulse activity.\n\n"
                "## Where\n"
                f"- {'`/portal/notifications`' if is_candidate else '`/notifications`'}\n"
                "- Also the bell icon in the top bar\n\n"
                "## Typical alerts\n"
                "- Applications, interviews, and system updates\n\n"
                "## Preferences\n"
                "- Adjust channels under **Settings**"
            ),
            [
                "How do I change notification settings?",
                "Where is Settings?",
                "How do interviews work?",
            ],
        ),
        "interviews": (
            (
                "Here's how **Interviews** work in HirePulse.\n\n"
                "## Staff\n"
                "- Open **Interviews** (`/interviews`)\n"
                "- Schedule phone, video, or onsite interviews for an application\n"
                "- You can also ask this Assistant to schedule when details are available\n\n"
                "## Candidates\n"
                "- Watch **Notifications** for interview invites and updates\n\n"
                "## Next steps\n"
                "- Staff: open Interviews or ask me to schedule with candidate + time."
            ),
            [
                "How do applications work?",
                "Where are notifications?",
                "Help me draft interview questions",
            ],
        ),
        "companies": (
            (
                "**Companies** in HirePulse are employer profiles linked to jobs.\n\n"
                "## Where\n"
                f"- Staff manage them at `/companies`\n"
                f"- Candidates open a company from a job card / job detail\n\n"
                "## Notes\n"
                "- Company name, industry, location, and open roles are shown\n"
                "- HirePulse uses the app brand mark instead of external company logos"
            ),
            [
                "How do Jobs work?",
                "How do I apply to a job?",
                "What is on the Dashboard?",
            ],
        ),
        "settings": (
            (
                "**Settings** control your HirePulse preferences.\n\n"
                "## Where\n"
                f"- {'`/portal/settings`' if is_candidate else '`/settings`'}\n\n"
                "## Common options\n"
                "- Theme / appearance\n"
                "- Notification preferences\n"
                "- Privacy: enable or disable AI processing for screening and this Assistant\n\n"
                "## Tip\n"
                "If the Assistant is blocked, turn on AI processing in Privacy settings."
            ),
            [
                "Where is my Profile?",
                "How do notifications work?",
                "What can you help me with?",
            ],
        ),
        "profile": (
            (
                "**Profile** is where you manage personal hiring information.\n\n"
                "## Where\n"
                f"- {'`/portal/profile`' if is_candidate else '`/profile`'}\n\n"
                "## What you can edit\n"
                "- Name, headline, about, experience, education\n"
                "- Skills (searchable multi-select — click **Save** to persist)\n"
                "- Resume upload / replace / preview / download / delete\n\n"
                "## Important\n"
                "Uploading a resume does **not** overwrite your profile fields."
            ),
            [
                "How do I upload a resume?",
                "How do I update skills?",
                "How do I apply to a job?",
            ],
        ),
        "auth": (
            (
                "Here's how **Authentication** works in HirePulse.\n\n"
                "## Pages\n"
                "- Login: `/login`\n"
                "- Register: `/register`\n\n"
                "## Roles\n"
                "- **Candidate** — portal for jobs, profile, screening, assistant\n"
                "- **Recruiter** — jobs, screening, interviews, candidates\n"
                "- **Admin** — full platform including users and reports\n\n"
                "## Next steps\n"
                "- Use Login with your email and password, or Register for a candidate account."
            ),
            [
                "What can candidates do?",
                "Where is Settings?",
                "What is the Dashboard?",
            ],
        ),
        "assistant": (
            (
                "I'm the **HirePulse AI Assistant** for this website.\n\n"
                "## I can help with\n"
                "- How to use HirePulse features (upload, screening, jobs, ATS, and more)\n"
                + (
                    "- Resume review, ATS tips, interview prep, and career guidance\n"
                    if is_candidate
                    else "- Hiring plans, candidate comparison, JD drafts, and interview scheduling\n"
                )
                + "- Answers that stay in this conversation's context\n\n"
                "## Next steps\n"
                "Ask about any page in the sidebar, or tell me your goal."
            ),
            [
                "How do I upload a resume?",
                "How does Resume Screening work?",
                "Where do I find Jobs?",
            ],
        ),
    }
    return replies.get(topic, replies["assistant"])
