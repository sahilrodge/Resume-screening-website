"""Multi-factor local resume screening (used when OpenAI is unavailable).

Weights (ATS):
  Skills 35% · Experience 20% · Education 15% · Projects 10%
  Certifications 10% · Structure 5% · Keyword density 5%
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.schemas.match_result import MatchResult

STOPWORDS = {
    "with", "from", "that", "this", "have", "will", "your", "about", "into",
    "their", "them", "than", "then", "also", "such", "able", "role", "team",
    "work", "using", "must", "should", "years", "year", "experience", "strong",
    "good", "etc", "and", "the", "for", "our", "you", "are", "all", "any",
}

SECTION_HINTS = (
    "experience",
    "education",
    "skill",
    "project",
    "certification",
    "summary",
    "objective",
    "work history",
    "employment",
    "achievements",
)

DEGREE_HINTS = (
    "bachelor", "master", "phd", "doctorate", "b.tech", "b.e", "m.tech",
    "mba", "bsc", "msc", "ba", "ma", "associate", "diploma", "degree",
)

CERT_HINTS = (
    "certified", "certification", "certificate", "aws", "azure", "gcp",
    "pmp", "scrum", "cissp", "comptia", "cka", "ckad", "tensorflow",
)

# High-signal skill lexicon — used to avoid diluting scores with filler JD words
KNOWN_SKILLS = {
    "python", "java", "javascript", "typescript", "golang", "go", "rust", "c++",
    "c#", "ruby", "php", "scala", "kotlin", "swift", "r", "matlab",
    "fastapi", "django", "flask", "spring", "express", "nestjs", "next.js",
    "react", "vue", "angular", "node", "nodejs", "node.js",
    "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch",
    "dynamodb", "sql", "nosql", "graphql", "rest", "rest apis", "grpc",
    "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "terraform",
    "ci/cd", "jenkins", "github actions", "gitlab", "linux", "unix",
    "microservices", "kafka", "rabbitmq", "spark", "hadoop", "airflow",
    "numpy", "pandas", "pytorch", "tensorflow", "scikit-learn", "ml",
    "machine learning", "deep learning", "nlp", "llm", "openai",
    "html", "css", "tailwind", "sass", "webpack", "vite",
    "agile", "scrum", "jira", "figma", "photoshop", "canva",
    "content writing", "social media", "seo", "marketing",
}


def _normalize_skill(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _tokens(text: str) -> set[str]:
    return {
        t.lower()
        for t in re.findall(r"[a-zA-Z][a-zA-Z0-9+.#-]{2,}", text or "")
        if len(t) > 2 and t.lower() not in STOPWORDS
    }


def _clamp(score: float) -> float:
    return max(0.0, min(100.0, round(score, 2)))


def _parse_payload(resume_payload: str) -> dict[str, Any]:
    text = (resume_payload or "").strip()
    if not text:
        return {}
    if text.startswith("{") or text.startswith("["):
        try:
            data = json.loads(text)
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _list_of_str(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            for key in ("name", "title", "degree", "institution", "company"):
                val = item.get(key)
                if isinstance(val, str) and val.strip():
                    out.append(val.strip())
                    break
    return out


def _flatten_resume_text(payload: str, parsed: dict[str, Any]) -> str:
    if parsed:
        chunks: list[str] = []
        for key in ("name", "email", "phone", "summary"):
            if parsed.get(key):
                chunks.append(str(parsed[key]))
        chunks.extend(_list_of_str(parsed.get("skills")))
        chunks.extend(_list_of_str(parsed.get("certifications")))
        for edu in parsed.get("education") or []:
            if isinstance(edu, dict):
                chunks.extend(str(v) for v in edu.values() if v)
        for exp in parsed.get("experience") or []:
            if isinstance(exp, dict):
                chunks.extend(str(v) for v in exp.values() if v)
        for proj in parsed.get("projects") or []:
            if isinstance(proj, dict):
                chunks.extend(str(v) for v in proj.values() if v)
                chunks.extend(_list_of_str(proj.get("technologies")))
        return "\n".join(chunks)
    return payload


def _extract_job_skills(job_title: str, job_description: str) -> list[str]:
    """Extract role-relevant skills from the JD (lexicon + bullet cues)."""
    text = f"{job_title}\n{job_description}"
    lower = text.lower()
    skills: list[str] = []
    seen: set[str] = set()

    def add(label: str) -> None:
        key = _normalize_skill(label)
        if not key or key in STOPWORDS or len(key) < 2 or key in seen:
            return
        seen.add(key)
        skills.append(label.strip())

    # 1) Known skill lexicon hits (multi-word first)
    for skill in sorted(KNOWN_SKILLS, key=len, reverse=True):
        pattern = r"(?<![a-z0-9+.#-])" + re.escape(skill) + r"(?![a-z0-9+.#-])"
        if re.search(pattern, lower):
            add(skill)

    # 2) Bullet / requirement lines often list concrete tools
    for line in text.splitlines():
        stripped = line.strip(" -\t•*")
        if not stripped or len(stripped) > 120:
            continue
        # Split lists but keep CI/CD-style tokens intact
        parts = re.split(r"\s*(?:,|;|\band\b|\bor\b)\s*", stripped)
        for part in parts:
            token = part.strip()
            key = _normalize_skill(token)
            # Strip trailing filler words from bullet fragments
            key = re.sub(r"\b(pipelines?|experience|skills?|knowledge|preferred)\b", "", key).strip()
            token = key if key in KNOWN_SKILLS else token
            key = _normalize_skill(token)
            if key in KNOWN_SKILLS or (
                2 <= len(key) <= 24
                and re.fullmatch(r"[a-z][a-z0-9+.#/-]{1,}", key)
                and key not in STOPWORDS
                and any(ch.isupper() for ch in part)
            ):
                add(token if token else part.strip())

    # 3) Fallback: capitalized tech-looking tokens if lexicon was sparse
    if len(skills) < 4:
        for item in re.findall(r"\b[A-Z][a-zA-Z0-9+.#-]{2,}(?:\s+[A-Z][a-zA-Z0-9+.#-]{2,})?\b", text):
            key = _normalize_skill(item)
            if key not in STOPWORDS and key not in {
                "requirements", "responsibilities", "qualifications", "about",
                "preferred", "hiring", "engineer", "senior", "junior",
            }:
                add(item)
            if len(skills) >= 24:
                break

    return skills[:24]


def _skill_present(skill: str, resume_skill_set: set[str], resume_lower: str) -> bool:
    key = _normalize_skill(skill)
    if not key:
        return False
    if key in resume_skill_set:
        return True
    # Whole-token / phrase match (avoid "rest" in "interested")
    pattern = r"(?<![a-z0-9+.#-])" + re.escape(key) + r"(?![a-z0-9+.#-])"
    if re.search(pattern, resume_lower):
        return True
    parts = [p for p in re.split(r"[\s]+", key) if len(p) > 2]
    if len(parts) >= 2 and all(
        re.search(r"(?<![a-z0-9+.#-])" + re.escape(p) + r"(?![a-z0-9+.#-])", resume_lower)
        for p in parts
    ):
        return True
    return False


def _skill_score(resume_skills: list[str], job_skills: list[str], resume_text: str) -> tuple[float, list[str], list[str]]:
    if not job_skills:
        richness = min(70.0, len(resume_skills) * 8.0)
        return richness, [], []
    resume_lower = resume_text.lower()
    resume_skill_set = {_normalize_skill(s) for s in resume_skills}
    matching: list[str] = []
    missing: list[str] = []
    for skill in job_skills:
        if _skill_present(skill, resume_skill_set, resume_lower):
            matching.append(skill)
        else:
            missing.append(skill)
    coverage = len(matching) / max(1, len(job_skills))
    score = (coverage ** 0.85) * 100
    return _clamp(score), matching[:16], missing[:16]


def _experience_score(parsed: dict[str, Any], resume_text: str, job_text: str) -> float:
    experiences = parsed.get("experience") if isinstance(parsed.get("experience"), list) else []
    count = len(experiences) if experiences else 0
    if count == 0:
        years = re.findall(r"(\d+)\+?\s*(?:years?|yrs?)", resume_text.lower())
        if years:
            count = min(4, max(1, int(years[0]) // 2))
    base = min(55.0, count * 16.0)
    # Prefer overlap against known skills mentioned in the JD
    job_lower = job_text.lower()
    skill_anchors = {s for s in KNOWN_SKILLS if s in job_lower}
    exp_text = " ".join(
        " ".join(str(v) for v in (item.values() if isinstance(item, dict) else []))
        for item in experiences
    ) or resume_text
    exp_lower = exp_text.lower()
    if skill_anchors:
        hits = sum(
            1
            for s in skill_anchors
            if re.search(r"(?<![a-z0-9+.#-])" + re.escape(s) + r"(?![a-z0-9+.#-])", exp_lower)
        )
        overlap = hits / max(1, len(skill_anchors))
    else:
        job_tokens = _tokens(job_text)
        exp_tokens = _tokens(exp_text)
        overlap = len(job_tokens & exp_tokens) / max(1, len(job_tokens)) if job_tokens else 0
    # Title similarity bonus
    title_bonus = 0.0
    for item in experiences:
        if isinstance(item, dict):
            title = str(item.get("title") or "").lower()
            if title and any(tok in title for tok in ("engineer", "developer", "backend", "python")):
                if any(tok in job_lower for tok in title.split() if len(tok) > 3):
                    title_bonus = 12.0
                    break
    return _clamp(base + overlap * 40 + title_bonus)


def _education_score(parsed: dict[str, Any], resume_text: str, job_text: str) -> float:
    education = parsed.get("education") if isinstance(parsed.get("education"), list) else []
    text = resume_text.lower()
    job = job_text.lower()
    has_edu = bool(education) or any(h in text for h in DEGREE_HINTS)
    if not has_edu:
        return 15.0 if "degree" in job or "bachelor" in job or "master" in job else 45.0
    score = 55.0 + min(25.0, len(education) * 12)
    if any(h in text for h in DEGREE_HINTS):
        score += 10
    # Bonus if job asks for degree and resume has one
    if any(h in job for h in DEGREE_HINTS) and any(h in text for h in DEGREE_HINTS):
        score += 10
    return _clamp(score)


def _projects_score(parsed: dict[str, Any], resume_text: str) -> float:
    projects = parsed.get("projects") if isinstance(parsed.get("projects"), list) else []
    if projects:
        return _clamp(50.0 + min(45.0, len(projects) * 15))
    if "project" in resume_text.lower():
        return 42.0
    return 12.0


def _certifications_score(parsed: dict[str, Any], resume_text: str, job_text: str) -> float:
    certs = _list_of_str(parsed.get("certifications"))
    text = resume_text.lower()
    job = job_text.lower()
    if not certs:
        certs = [h for h in CERT_HINTS if h in text]
    if not certs:
        # Low when job hints at certs; otherwise modest baseline
        return 18.0 if any(h in job for h in CERT_HINTS) else 40.0
    score = 55.0 + min(35.0, len(certs) * 10)
    job_hits = sum(1 for c in certs if c.lower() in job)
    score += min(10.0, job_hits * 5)
    return _clamp(score)


def _structure_score(resume_text: str, parsed: dict[str, Any]) -> float:
    text = resume_text.lower()
    hits = sum(1 for hint in SECTION_HINTS if hint in text)
    score = min(70.0, hits * 10)
    if parsed.get("skills"):
        score += 8
    if parsed.get("experience"):
        score += 8
    if parsed.get("education"):
        score += 6
    if parsed.get("email") or re.search(r"@", resume_text):
        score += 4
    if parsed.get("phone") or re.search(r"\d{3}", resume_text):
        score += 4
    return _clamp(score)


def _keyword_density_score(resume_text: str, job_text: str) -> float:
    job_tokens = _tokens(job_text)
    if not job_tokens:
        return 40.0
    resume_tokens = _tokens(resume_text)
    coverage = len(job_tokens & resume_tokens) / max(1, len(job_tokens))
    # Density: how concentrated relevant tokens are
    density = len(job_tokens & resume_tokens) / max(1, len(resume_tokens))
    return _clamp(coverage * 75 + density * 25)


def _confidence_from_factors(parsed: dict[str, Any], resume_text: str) -> float:
    signals = 0
    if parsed.get("skills"):
        signals += 1
    if parsed.get("experience"):
        signals += 1
    if parsed.get("education"):
        signals += 1
    if parsed.get("projects"):
        signals += 1
    if parsed.get("certifications") or any(h in resume_text.lower() for h in CERT_HINTS):
        signals += 1
    if len(resume_text) > 400:
        signals += 1
    # Local analysis confidence stays below AI
    return _clamp(45 + signals * 8)


def local_screen_resume(
    *,
    job_title: str,
    job_description: str,
    resume_payload: str,
) -> MatchResult:
    """Compute realistic ATS + match scores without hardcoded floors."""
    parsed = _parse_payload(resume_payload)
    resume_text = _flatten_resume_text(resume_payload, parsed)
    job_text = f"{job_title}\n{job_description}"

    resume_skills = _list_of_str(parsed.get("skills"))
    job_skills = _extract_job_skills(job_title, job_description)

    skills_score, matching, missing = _skill_score(
        resume_skills, job_skills, resume_text
    )
    experience_score = _experience_score(parsed, resume_text, job_text)
    education_score = _education_score(parsed, resume_text, job_text)
    projects_score = _projects_score(parsed, resume_text)
    certifications_score = _certifications_score(parsed, resume_text, job_text)
    structure_score = _structure_score(resume_text, parsed)
    keyword_score = _keyword_density_score(resume_text, job_text)

    ats_score = _clamp(
        skills_score * 0.35
        + experience_score * 0.20
        + education_score * 0.15
        + projects_score * 0.10
        + certifications_score * 0.10
        + structure_score * 0.05
        + keyword_score * 0.05
    )

    # Role-fit match leans on skills + experience (+ light keyword/education)
    match_score = _clamp(
        skills_score * 0.50
        + experience_score * 0.30
        + education_score * 0.10
        + keyword_score * 0.10
    )

    strengths: list[str] = []
    if matching:
        strengths.append(f"Strong evidence of {', '.join(matching[:3])}")
    if experience_score >= 60:
        strengths.append("Relevant work experience for this role")
    if education_score >= 60:
        strengths.append("Education background aligns with typical requirements")
    if projects_score >= 55:
        strengths.append("Projects demonstrate applied skills")
    if certifications_score >= 60:
        strengths.append("Professional certifications present")
    if structure_score >= 65:
        strengths.append("Resume structure is ATS-friendly")
    if not strengths:
        strengths.append("Resume content is available for recruiter review")

    weaknesses: list[str] = []
    if missing[:4]:
        weaknesses.append(f"Limited evidence of {', '.join(missing[:3])}")
    if experience_score < 40:
        weaknesses.append("Work experience may not clearly match the role")
    if education_score < 40:
        weaknesses.append("Education details are thin or missing")
    if projects_score < 30:
        weaknesses.append("Few or no projects listed")
    if structure_score < 40:
        weaknesses.append("Resume structure could be clearer for ATS parsing")
    if not weaknesses:
        weaknesses.append("Minor keyword gaps relative to the job description")

    suggestions = [
        "Mirror high-priority job keywords in a dedicated Skills section",
        "Add measurable achievements under recent roles",
        "Ensure education, projects, and certifications are clearly sectioned",
    ]
    if missing:
        suggestions.insert(0, f"Add evidence for: {', '.join(missing[:4])}")

    confidence = _confidence_from_factors(parsed, resume_text)

    return MatchResult(
        match_score=match_score,
        ats_score=ats_score,
        matching_skills=matching,
        missing_skills=missing,
        strengths=strengths[:6],
        weaknesses=weaknesses[:6],
        suggestions=suggestions[:6],
        summary=(
            f"Local analysis for “{job_title}”: match {int(match_score)}%, "
            f"ATS {int(ats_score)}%. Scores blend skills, experience, education, "
            f"projects, certifications, structure, and keyword density."
        ),
        reasoning=(
            "Local multi-factor breakdown — "
            f"skills {skills_score:.0f}, experience {experience_score:.0f}, "
            f"education {education_score:.0f}, projects {projects_score:.0f}, "
            f"certifications {certifications_score:.0f}, structure {structure_score:.0f}, "
            f"keywords {keyword_score:.0f}."
        ),
        scoring_engine="local",
        confidence=confidence,
    )
