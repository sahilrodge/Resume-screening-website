"""OpenAI-powered resume parsing with richer local fallback."""

from __future__ import annotations

import json
import re

from openai import OpenAI

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.schemas.parsed_resume import (
    EducationItem,
    ExperienceItem,
    ParsedResumeData,
    ProjectItem,
)

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are an expert resume parser for a recruitment platform.
Extract structured data from the resume text.
Return ONLY valid JSON matching this schema:
{
  "name": string|null,
  "email": string|null,
  "phone": string|null,
  "education": [{"institution": string|null, "degree": string|null, "field": string|null, "start_date": string|null, "end_date": string|null}],
  "experience": [{"company": string|null, "title": string|null, "start_date": string|null, "end_date": string|null, "description": string|null}],
  "skills": [string],
  "projects": [{"name": string|null, "description": string|null, "technologies": [string]}],
  "certifications": [string]
}
Rules:
- Prefer accuracy over completeness; use null for unknown fields.
- skills should be a flat list of unique skill names.
- certifications should list certificate / license names only.
- Keep dates as short strings as written on the resume.
- Do not invent employers, schools, or skills not present in the text.
"""

KNOWN_SKILLS = (
    "Python", "JavaScript", "TypeScript", "React", "Node.js", "Next.js", "SQL",
    "PostgreSQL", "MySQL", "MongoDB", "AWS", "Azure", "GCP", "Docker", "Kubernetes",
    "FastAPI", "Django", "Flask", "Java", "C++", "C#", ".NET", "Go", "Rust",
    "HTML", "CSS", "Git", "Linux", "Excel", "Power BI", "Machine Learning",
    "Deep Learning", "NLP", "TensorFlow", "PyTorch", "Pandas", "NumPy", "REST",
    "GraphQL", "CI/CD", "Agile", "Scrum", "Redis", "Kafka", "Spark", "Tableau",
    "Figma", "Selenium", "Pytest", "Jest", "Spring", "Hibernate", "Angular",
    "Vue", "Svelte", "Kotlin", "Swift", "PHP", "Laravel", "Ruby", "Rails",
)


def parse_resume_text(raw_text: str) -> ParsedResumeData:
    """Call OpenAI to extract structured resume fields."""
    if not settings.openai_configured:
        raise AppException(
            "OpenAI is not configured. Set OPENAI_API_KEY in the backend .env file "
            "and restart the API server.",
            status_code=503,
            code="openai_not_configured",
        )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        completion = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Parse this resume text:\n\n{raw_text[:14000]}",
                },
            ],
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("OpenAI resume parse failed")
        raise AppException(
            "OpenAI resume parsing failed",
            status_code=502,
            code="openai_parse_failed",
            details=str(exc),
        ) from exc

    content = completion.choices[0].message.content or "{}"
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise AppException(
            "OpenAI returned invalid JSON",
            status_code=502,
            code="openai_invalid_json",
            details=content[:500],
        ) from exc

    return ParsedResumeData.model_validate(payload)


def _section_block(text: str, headings: tuple[str, ...]) -> str:
    pattern = (
        r"(?is)(?:^|\n)\s*(?:"
        + "|".join(re.escape(h) for h in headings)
        + r")\s*:?\s*\n(.*?)(?=\n\s*(?:experience|education|skills?|projects?|"
        r"certifications?|summary|objective|achievements?|work history|"
        r"employment|contact)\s*:?\s*\n|$)"
    )
    match = re.search(pattern, text)
    return match.group(1).strip() if match else ""


def _unique(items: list[str], limit: int = 40) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        cleaned = re.sub(r"\s+", " ", item).strip(" •-\t")
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cleaned)
        if len(out) >= limit:
            break
    return out


def fallback_parse_resume_text(raw_text: str) -> ParsedResumeData:
    """Best-effort local parse when OpenAI is unavailable or fails."""
    text = (raw_text or "").strip()
    if not text:
        raise AppException(
            "Resume has no extractable text to parse",
            status_code=400,
            code="resume_no_text",
        )

    email_match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.I)
    phone_match = re.search(
        r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}",
        text,
    )
    first_line = next(
        (line.strip() for line in text.splitlines() if line.strip()),
        None,
    )
    name = first_line[:120] if first_line and "@" not in first_line else None

    # Skills: known list + comma/bullet tokens from Skills section
    skill_hits = [
        skill
        for skill in KNOWN_SKILLS
        if re.search(rf"\b{re.escape(skill)}\b", text, flags=re.I)
    ]
    skills_block = _section_block(text, ("skills", "technical skills", "core skills"))
    if skills_block:
        skill_hits.extend(re.split(r"[,|/•\n]", skills_block))
    skills = _unique(skill_hits, limit=50)

    # Education
    edu_block = _section_block(text, ("education", "academic", "academics"))
    education: list[EducationItem] = []
    for line in (edu_block or text).splitlines():
        line = line.strip(" •-\t")
        if not line or len(line) < 8:
            continue
        if not re.search(
            r"bachelor|master|phd|b\.?tech|m\.?tech|mba|bsc|msc|university|college|diploma",
            line,
            re.I,
        ):
            continue
        education.append(
            EducationItem(
                institution=line[:160],
                degree=None,
                field=None,
                start_date=None,
                end_date=None,
            )
        )
        if len(education) >= 5:
            break

    # Experience
    exp_block = _section_block(
        text, ("experience", "work experience", "employment", "work history")
    )
    experience: list[ExperienceItem] = []
    for raw_line in (exp_block or "").splitlines():
        line = raw_line.strip(" •-\t")
        if len(line) < 6:
            continue
        if re.search(r"\b(20\d{2}|19\d{2})\b", line) or " - " in line or " at " in line.lower():
            experience.append(
                ExperienceItem(
                    company=None,
                    title=line[:160],
                    start_date=None,
                    end_date=None,
                    description=None,
                )
            )
        if len(experience) >= 8:
            break

    # Projects
    proj_block = _section_block(text, ("projects", "personal projects", "key projects"))
    projects: list[ProjectItem] = []
    for line in (proj_block or "").splitlines():
        line = line.strip(" •-\t")
        if len(line) < 4:
            continue
        projects.append(ProjectItem(name=line[:120], description=None, technologies=[]))
        if len(projects) >= 8:
            break

    # Certifications
    cert_block = _section_block(
        text, ("certifications", "certificates", "licenses", "certification")
    )
    certs = []
    if cert_block:
        certs.extend(re.split(r"[,|\n•]", cert_block))
    for hint in ("aws", "azure", "gcp", "pmp", "scrum", "cissp", "cka", "comptia"):
        if re.search(rf"\b{hint}\b", text, re.I):
            certs.append(hint.upper() if len(hint) <= 4 else hint.title())
    certifications = _unique(certs, limit=20)

    return ParsedResumeData(
        name=name,
        email=email_match.group(0) if email_match else None,
        phone=phone_match.group(0).strip() if phone_match else None,
        education=education,
        experience=experience,
        skills=skills,
        projects=projects,
        certifications=certifications,
    )


def parse_resume_text_with_fallback(raw_text: str) -> tuple[ParsedResumeData, str | None]:
    """
    Parse with OpenAI when configured; otherwise (or on failure) use local fallback.

    Returns (parsed, warning_or_none).
    """
    if settings.openai_configured:
        try:
            return parse_resume_text(raw_text), None
        except AppException as exc:
            logger.warning("Falling back to local resume parse: %s", exc.message)
            return fallback_parse_resume_text(raw_text), exc.message
    return fallback_parse_resume_text(raw_text), "openai_not_configured"
