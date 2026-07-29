"""Local multi-factor screening: excellent / medium / poor matches must diverge."""

from __future__ import annotations

import json

from app.ai.local_screener import local_screen_resume

JOB_TITLE = "Senior Python Backend Engineer"

JOB_DESCRIPTION = """
We are hiring a Senior Python Backend Engineer.

Requirements:
- 5+ years experience with Python and FastAPI
- Strong PostgreSQL and Redis skills
- Experience with Docker, Kubernetes, and AWS
- Bachelor's degree in Computer Science or related field
- AWS Certified Developer or similar certifications preferred
- Build REST APIs, microservices, and CI/CD pipelines
- Experience shipping production projects with measurable impact
"""


def _resume(**kwargs: object) -> str:
    return json.dumps(kwargs, indent=2)


EXCELLENT = _resume(
    name="Alex Chen",
    email="alex@example.com",
    phone="+1-555-0100",
    summary="Senior Python engineer with deep FastAPI and cloud experience.",
    skills=[
        "Python",
        "FastAPI",
        "PostgreSQL",
        "Redis",
        "Docker",
        "Kubernetes",
        "AWS",
        "CI/CD",
        "REST APIs",
        "Microservices",
    ],
    education=[
        {
            "institution": "MIT",
            "degree": "Bachelor of Science",
            "field": "Computer Science",
            "start_date": "2012",
            "end_date": "2016",
        }
    ],
    experience=[
        {
            "company": "CloudScale",
            "title": "Senior Python Backend Engineer",
            "start_date": "2020",
            "end_date": "Present",
            "description": (
                "Built FastAPI microservices on AWS with PostgreSQL and Redis. "
                "Led Docker/Kubernetes deployments and CI/CD."
            ),
        },
        {
            "company": "DataPipe",
            "title": "Python Developer",
            "start_date": "2016",
            "end_date": "2020",
            "description": "Designed REST APIs and production data pipelines.",
        },
    ],
    projects=[
        {
            "name": "API Gateway",
            "description": "FastAPI gateway with Redis caching",
            "technologies": ["Python", "FastAPI", "Redis"],
        },
        {
            "name": "Hiring Platform",
            "description": "Microservice recruiting backend on Kubernetes",
            "technologies": ["Docker", "Kubernetes", "PostgreSQL"],
        },
    ],
    certifications=["AWS Certified Developer - Associate", "CKA"],
)

MEDIUM = _resume(
    name="Jordan Lee",
    email="jordan@example.com",
    phone="+1-555-0200",
    summary="Software developer with some Python and web experience.",
    skills=["Python", "Django", "SQL", "Git", "JavaScript"],
    education=[
        {
            "institution": "State University",
            "degree": "Bachelor of Science",
            "field": "Information Systems",
            "start_date": "2015",
            "end_date": "2019",
        }
    ],
    experience=[
        {
            "company": "RetailCo",
            "title": "Software Developer",
            "start_date": "2019",
            "end_date": "Present",
            "description": "Maintained Django apps and SQL databases for retail tools.",
        }
    ],
    projects=[
        {
            "name": "Inventory Bot",
            "description": "Python script for inventory sync",
            "technologies": ["Python"],
        }
    ],
    certifications=[],
)

POOR = _resume(
    name="Sam Patel",
    email="sam@example.com",
    summary="Recent graduate interested in marketing and design.",
    skills=["Photoshop", "Canva", "Content Writing", "Social Media"],
    education=[
        {
            "institution": "Art College",
            "degree": "Bachelor of Arts",
            "field": "Graphic Design",
            "start_date": "2019",
            "end_date": "2023",
        }
    ],
    experience=[
        {
            "company": "AgencyX",
            "title": "Marketing Intern",
            "start_date": "2023",
            "end_date": "2024",
            "description": "Created social posts and brand visuals.",
        }
    ],
    projects=[],
    certifications=[],
)


def test_excellent_medium_poor_scores_diverge_significantly() -> None:
    excellent = local_screen_resume(
        job_title=JOB_TITLE,
        job_description=JOB_DESCRIPTION,
        resume_payload=EXCELLENT,
    )
    medium = local_screen_resume(
        job_title=JOB_TITLE,
        job_description=JOB_DESCRIPTION,
        resume_payload=MEDIUM,
    )
    poor = local_screen_resume(
        job_title=JOB_TITLE,
        job_description=JOB_DESCRIPTION,
        resume_payload=POOR,
    )

    assert excellent.scoring_engine == "local"
    assert medium.scoring_engine == "local"
    assert poor.scoring_engine == "local"

    assert excellent.match_score > medium.match_score > poor.match_score
    assert excellent.ats_score > medium.ats_score > poor.ats_score

    # Significant separation across tiers (not a flat ~15% floor)
    assert excellent.match_score - poor.match_score >= 40
    assert excellent.match_score - medium.match_score >= 20
    assert medium.match_score - poor.match_score >= 8
    assert excellent.match_score >= 70
    assert medium.match_score < 55
    assert poor.match_score <= 25
    assert poor.match_score != 15.0
    assert {round(excellent.match_score), round(medium.match_score), round(poor.match_score)} == {
        round(excellent.match_score),
        round(medium.match_score),
        round(poor.match_score),
    }

    assert excellent.confidence is not None
    assert excellent.confidence >= medium.confidence >= 40


def test_no_global_fifteen_percent_floor_on_empty_resume() -> None:
    empty = local_screen_resume(
        job_title=JOB_TITLE,
        job_description=JOB_DESCRIPTION,
        resume_payload="{}",
    )
    assert empty.match_score < 15 or empty.ats_score < 25
    assert empty.scoring_engine == "local"
    assert 0 <= empty.match_score <= 100
    assert 0 <= empty.ats_score <= 100


def test_local_result_includes_transparency_fields() -> None:
    result = local_screen_resume(
        job_title=JOB_TITLE,
        job_description=JOB_DESCRIPTION,
        resume_payload=MEDIUM,
    )
    assert result.scoring_engine == "local"
    assert 0 <= result.confidence <= 100
    assert result.strengths
    assert result.weaknesses
    assert result.suggestions
    assert result.summary
    assert "Local multi-factor" in result.reasoning
