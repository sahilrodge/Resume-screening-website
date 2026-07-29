"""Local resume parser extraction smoke tests."""

from __future__ import annotations

from app.ai.resume_parser import fallback_parse_resume_text

SAMPLE = """
Jane Doe
jane.doe@example.com
+1-555-0199

SUMMARY
Backend engineer focused on Python APIs.

SKILLS
Python, FastAPI, PostgreSQL, Docker, AWS

EXPERIENCE
Acme Corp — Software Engineer (2020 - Present)
Built REST APIs with FastAPI and PostgreSQL.

EDUCATION
University of Example — B.S. Computer Science (2016 - 2020)

PROJECTS
Resume Screener — Matching engine using FastAPI and Redis

CERTIFICATIONS
AWS Certified Developer - Associate
"""


def test_local_parse_extracts_core_sections() -> None:
    parsed = fallback_parse_resume_text(SAMPLE)
    assert parsed.email and "jane.doe" in parsed.email.lower()
    assert parsed.phone
    assert any("python" in s.lower() for s in parsed.skills)
    assert parsed.education
    assert parsed.experience
    assert parsed.projects
    assert any("aws" in c.lower() for c in parsed.certifications)
