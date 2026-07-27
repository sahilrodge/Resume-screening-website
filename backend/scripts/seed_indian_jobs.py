"""Seed 60 realistic Indian job postings across major tech companies.

Usage (from backend/):
  python -m scripts.seed_indian_jobs
  python -m scripts.seed_indian_jobs --force   # replace previous seed jobs
"""

from __future__ import annotations

import argparse
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.database.session import SessionLocal
from app.models.company import Company
from app.models.enums import EmploymentType, JobStatus, SkillLevel
from app.models.job import Job
from app.models.skill import JobSkill
from app.crud.skill import skill as skill_crud

SEED_TAG = "<!-- seed:indian_jobs_v1 -->"

COMPANIES: list[dict[str, str]] = [
    {
        "name": "TCS",
        "website": "https://www.tcs.com",
        "industry": "IT Services",
        "location": "Mumbai",
        "domain": "tcs.com",
        "description": "Tata Consultancy Services — India's largest IT services and consulting firm.",
    },
    {
        "name": "Infosys",
        "website": "https://www.infosys.com",
        "industry": "IT Services",
        "location": "Bangalore",
        "domain": "infosys.com",
        "description": "Infosys — global digital services and consulting leader headquartered in Bengaluru.",
    },
    {
        "name": "Wipro",
        "website": "https://www.wipro.com",
        "industry": "IT Services",
        "location": "Bangalore",
        "domain": "wipro.com",
        "description": "Wipro Limited — multinational technology consulting and business process services company.",
    },
    {
        "name": "Accenture",
        "website": "https://www.accenture.com/in-en",
        "industry": "Consulting",
        "location": "Bangalore",
        "domain": "accenture.com",
        "description": "Accenture India — strategy, consulting, digital, technology, and operations services.",
    },
    {
        "name": "Deloitte",
        "website": "https://www2.deloitte.com/in",
        "industry": "Consulting",
        "location": "Hyderabad",
        "domain": "deloitte.com",
        "description": "Deloitte India — audit, consulting, financial advisory, risk, and tax services.",
    },
    {
        "name": "Capgemini",
        "website": "https://www.capgemini.com/in-en",
        "industry": "IT Services",
        "location": "Mumbai",
        "domain": "capgemini.com",
        "description": "Capgemini India — engineering, technology, and digital transformation partner.",
    },
    {
        "name": "Cognizant",
        "website": "https://www.cognizant.com/in/en",
        "industry": "IT Services",
        "location": "Chennai",
        "domain": "cognizant.com",
        "description": "Cognizant — IT services and digital engineering with large delivery centres across India.",
    },
    {
        "name": "HCL",
        "website": "https://www.hcltech.com",
        "industry": "IT Services",
        "location": "Noida",
        "domain": "hcltech.com",
        "description": "HCLTech — global technology company offering digital, engineering, and cloud services.",
    },
    {
        "name": "IBM India",
        "website": "https://www.ibm.com/in-en",
        "industry": "Technology",
        "location": "Bangalore",
        "domain": "ibm.com",
        "description": "IBM India — hybrid cloud, AI, and enterprise software research and delivery hub.",
    },
    {
        "name": "Tech Mahindra",
        "website": "https://www.techmahindra.com",
        "industry": "IT Services",
        "location": "Pune",
        "domain": "techmahindra.com",
        "description": "Tech Mahindra — digital transformation, telecom, and enterprise IT services.",
    },
    {
        "name": "Zoho",
        "website": "https://www.zoho.com",
        "industry": "SaaS",
        "location": "Chennai",
        "domain": "zoho.com",
        "description": "Zoho Corporation — Indian SaaS product company building business productivity software.",
    },
    {
        "name": "PhonePe",
        "website": "https://www.phonepe.com",
        "industry": "Fintech",
        "location": "Bangalore",
        "domain": "phonepe.com",
        "description": "PhonePe — India's leading digital payments and financial services platform.",
    },
    {
        "name": "Razorpay",
        "website": "https://razorpay.com",
        "industry": "Fintech",
        "location": "Bangalore",
        "domain": "razorpay.com",
        "description": "Razorpay — full-stack payments and banking platform for Indian businesses.",
    },
    {
        "name": "Groww",
        "website": "https://groww.in",
        "industry": "Fintech",
        "location": "Bangalore",
        "domain": "groww.in",
        "description": "Groww — investment platform for stocks, mutual funds, and digital gold.",
    },
    {
        "name": "Swiggy",
        "website": "https://www.swiggy.com",
        "industry": "Consumer Internet",
        "location": "Bangalore",
        "domain": "swiggy.com",
        "description": "Swiggy — food delivery, quick commerce, and dining platform.",
    },
    {
        "name": "Zomato",
        "website": "https://www.zomato.com",
        "industry": "Consumer Internet",
        "location": "Gurgaon",
        "domain": "zomato.com",
        "description": "Zomato — food delivery and restaurant discovery platform.",
    },
    {
        "name": "Flipkart",
        "website": "https://www.flipkart.com",
        "industry": "E-commerce",
        "location": "Bangalore",
        "domain": "flipkart.com",
        "description": "Flipkart — India's leading e-commerce marketplace.",
    },
    {
        "name": "Amazon India",
        "website": "https://www.amazon.in",
        "industry": "E-commerce",
        "location": "Hyderabad",
        "domain": "amazon.in",
        "description": "Amazon India — e-commerce, AWS, and device operations across India.",
    },
    {
        "name": "Microsoft India",
        "website": "https://www.microsoft.com/en-in",
        "industry": "Technology",
        "location": "Hyderabad",
        "domain": "microsoft.com",
        "description": "Microsoft India — cloud, productivity, and AI product engineering.",
    },
    {
        "name": "Google India",
        "website": "https://careers.google.com/locations/india/",
        "industry": "Technology",
        "location": "Bangalore",
        "domain": "google.com",
        "description": "Google India — search, ads, Android, Cloud, and AI research & engineering.",
    },
]

ROLES: list[dict] = [
    {
        "title": "Data Analyst",
        "skills": ["SQL", "Python", "Excel", "Tableau", "Power BI", "Statistics"],
        "exp": (1, 4),
        "salary_lpa": (6, 14),
        "summary": "Turn business questions into actionable insights using SQL, dashboards, and statistical analysis.",
    },
    {
        "title": "Business Analyst",
        "skills": ["Requirement Gathering", "Jira", "SQL", "Agile", "Stakeholder Management", "Excel"],
        "exp": (2, 6),
        "salary_lpa": (7, 16),
        "summary": "Bridge business and technology teams by defining requirements, user stories, and process improvements.",
    },
    {
        "title": "Software Engineer",
        "skills": ["Java", "Python", "Git", "Data Structures", "REST APIs", "SQL"],
        "exp": (1, 5),
        "salary_lpa": (8, 22),
        "summary": "Design, build, and ship reliable software features in a collaborative agile environment.",
    },
    {
        "title": "Backend Developer",
        "skills": ["Python", "Java", "Node.js", "PostgreSQL", "Redis", "Microservices", "Docker"],
        "exp": (2, 6),
        "salary_lpa": (10, 25),
        "summary": "Build scalable APIs and services powering high-traffic Indian digital products.",
    },
    {
        "title": "Frontend Developer",
        "skills": ["React", "TypeScript", "JavaScript", "HTML", "CSS", "Next.js", "Redux"],
        "exp": (1, 5),
        "salary_lpa": (8, 20),
        "summary": "Craft fast, accessible web interfaces used by millions of customers across India.",
    },
    {
        "title": "Full Stack Developer",
        "skills": ["React", "Node.js", "Python", "PostgreSQL", "TypeScript", "AWS", "Docker"],
        "exp": (2, 7),
        "salary_lpa": (10, 28),
        "summary": "Own features end-to-end across frontend, backend, and cloud infrastructure.",
    },
    {
        "title": "ML Engineer",
        "skills": ["Python", "PyTorch", "TensorFlow", "scikit-learn", "MLOps", "Feature Engineering"],
        "exp": (2, 6),
        "salary_lpa": (12, 35),
        "summary": "Productionise machine learning models with strong engineering and monitoring practices.",
    },
    {
        "title": "AI Engineer",
        "skills": ["Python", "LLMs", "LangChain", "OpenAI", "Vector Databases", "Prompt Engineering", "RAG"],
        "exp": (2, 7),
        "salary_lpa": (14, 40),
        "summary": "Build generative AI applications, RAG pipelines, and intelligent automation for enterprise use cases.",
    },
    {
        "title": "Data Scientist",
        "skills": ["Python", "Machine Learning", "SQL", "Statistics", "Pandas", "Experiment Design"],
        "exp": (2, 6),
        "salary_lpa": (12, 35),
        "summary": "Apply statistical modelling and ML to solve forecasting, personalisation, and risk problems.",
    },
    {
        "title": "Python Developer",
        "skills": ["Python", "Django", "FastAPI", "PostgreSQL", "Celery", "REST APIs", "Unit Testing"],
        "exp": (1, 5),
        "salary_lpa": (8, 20),
        "summary": "Develop robust Python services, APIs, and automation used across product and platform teams.",
    },
]

LOCATIONS = [
    "Pune",
    "Mumbai",
    "Bangalore",
    "Hyderabad",
    "Chennai",
    "Gurgaon",
    "Noida",
]

EMPLOYMENT_MIX = [
    EmploymentType.FULL_TIME,
    EmploymentType.FULL_TIME,
    EmploymentType.FULL_TIME,
    EmploymentType.FULL_TIME,
    EmploymentType.CONTRACT,
    EmploymentType.REMOTE,
    EmploymentType.INTERNSHIP,
]


def logo_url(domain: str) -> str:
    return f"https://logo.clearbit.com/{domain}"


def lpa_to_inr(lpa: float) -> float:
    return round(lpa * 100_000, 2)


def build_description(
    *,
    company: str,
    role: dict,
    location: str,
    exp_min: int,
    exp_max: int,
    salary_min: float,
    salary_max: float,
    employment: EmploymentType,
    skills: list[str],
) -> str:
    emp = employment.value.replace("_", " ")
    return f"""About the role
{company} is hiring a {role['title']} for its {location} team. {role['summary']}

Key responsibilities
• Partner with product, engineering, and business stakeholders to deliver high-impact outcomes
• Own assigned modules end-to-end — from design and implementation to testing and production rollout
• Write clean, well-tested code / analyses and participate in peer reviews
• Improve reliability, performance, and developer experience on existing systems
• Document decisions, share knowledge, and mentor junior teammates where applicable
• Collaborate in Agile ceremonies and contribute to continuous improvement

Required skills
{chr(10).join(f'• {s}' for s in skills)}

Experience
{exp_min}–{exp_max} years of relevant experience in India or comparable markets.

Compensation
INR {salary_min/100000:.1f}–{salary_max/100000:.1f} LPA (CTC) depending on experience and interview performance.
Employment type: {emp.title()}. Location: {location} (hybrid/onsite as per team policy).

Why join {company}
Work on large-scale Indian technology problems with strong mentorship, learning budget, and clear growth paths.

{SEED_TAG}
"""


def ensure_companies(db) -> dict[str, Company]:
    by_name: dict[str, Company] = {}
    for item in COMPANIES:
        existing = db.scalar(select(Company).where(Company.name == item["name"]))
        if existing:
            existing.website = item["website"]
            existing.industry = item["industry"]
            existing.location = item["location"]
            existing.description = item["description"]
            existing.logo_url = logo_url(item["domain"])
            db.add(existing)
            by_name[item["name"]] = existing
        else:
            company = Company(
                name=item["name"],
                website=item["website"],
                industry=item["industry"],
                location=item["location"],
                description=item["description"],
                logo_url=logo_url(item["domain"]),
            )
            db.add(company)
            db.flush()
            by_name[item["name"]] = company
    db.commit()
    for name, company in list(by_name.items()):
        by_name[name] = db.get(Company, company.id)  # type: ignore[assignment]
    return by_name


def clear_seed_jobs(db) -> int:
    stmt = select(Job).where(Job.description.contains(SEED_TAG))
    jobs = list(db.scalars(stmt).all())
    count = len(jobs)
    for job in jobs:
        db.delete(job)
    db.commit()
    return count


def attach_skills(db, job: Job, skill_names: list[str]) -> None:
    for name in skill_names:
        skill = skill_crud.get_or_create(db, name=name)
        exists = db.scalar(
            select(JobSkill).where(
                JobSkill.job_id == job.id,
                JobSkill.skill_id == skill.id,
            )
        )
        if exists:
            continue
        db.add(
            JobSkill(
                job_id=job.id,
                skill_id=skill.id,
                is_required=True,
                level=SkillLevel.INTERMEDIATE,
            )
        )


def generate_jobs(db, companies: dict[str, Company], *, rng: random.Random) -> list[Job]:
    now = datetime.now(timezone.utc)
    created: list[Job] = []
    company_list = list(COMPANIES)

    # 20 companies × 3 roles = 60 jobs
    for company_idx, company_meta in enumerate(company_list):
        company = companies[company_meta["name"]]
        for slot in range(3):
            role_idx = (company_idx * 3 + slot) % len(ROLES)
            role = ROLES[role_idx]
            location = LOCATIONS[(company_idx + slot * 3) % len(LOCATIONS)]
            employment = EMPLOYMENT_MIX[(company_idx + slot) % len(EMPLOYMENT_MIX)]

            exp_min, exp_max = role["exp"]
            # Slight jitter per posting
            if rng.random() < 0.35 and exp_min > 0:
                exp_min = max(0, exp_min - 1)
            if rng.random() < 0.35:
                exp_max = exp_max + 1

            sal_lo, sal_hi = role["salary_lpa"]
            # Product companies pay a bit higher; services a bit lower
            productish = company_meta["industry"] in {
                "Fintech",
                "SaaS",
                "Consumer Internet",
                "E-commerce",
                "Technology",
            }
            bump = 1.15 if productish else 1.0
            salary_min = lpa_to_inr(sal_lo * bump)
            salary_max = lpa_to_inr(sal_hi * bump)
            if employment == EmploymentType.INTERNSHIP:
                salary_min = lpa_to_inr(3)
                salary_max = lpa_to_inr(6)
                exp_min, exp_max = 0, 1

            skills = list(role["skills"])
            # Add one company-flavoured skill occasionally
            extras = {
                "Fintech": "Payments",
                "E-commerce": "Marketplace",
                "Consumer Internet": "Mobile Apps",
                "SaaS": "Multi-tenant Systems",
                "Consulting": "Client Delivery",
                "IT Services": "Enterprise Integration",
                "Technology": "Cloud",
            }
            extra = extras.get(company_meta["industry"])
            if extra and extra not in skills:
                skills = skills + [extra]

            closes_at = now + timedelta(days=rng.randint(30, 90))
            openings = rng.choice([1, 1, 2, 2, 3, 5])

            description = build_description(
                company=company_meta["name"],
                role=role,
                location=location,
                exp_min=exp_min,
                exp_max=exp_max,
                salary_min=salary_min,
                salary_max=salary_max,
                employment=employment,
                skills=skills,
            )

            job = Job(
                company_id=company.id,
                title=role["title"],
                description=description,
                location=location,
                employment_type=employment,
                status=JobStatus.OPEN,
                salary_min=salary_min,
                salary_max=salary_max,
                currency="INR",
                experience_min_years=exp_min,
                experience_max_years=exp_max,
                openings=openings,
                published_at=now - timedelta(days=rng.randint(0, 14)),
                closes_at=closes_at,
            )
            db.add(job)
            db.flush()
            attach_skills(db, job, skills)
            created.append(job)

    db.commit()
    return created


def seed(*, force: bool = False) -> None:
    db = SessionLocal()
    try:
        existing = db.scalar(
            select(func.count()).select_from(Job).where(Job.description.contains(SEED_TAG))
        ) or 0

        if existing and not force:
            print(f"Seed already present ({existing} jobs). Use --force to replace.")
            companies = db.scalars(
                select(Company).where(Company.name.in_([c["name"] for c in COMPANIES]))
            ).all()
            print(f"Companies ready: {len(list(companies))}")
            return

        if existing and force:
            removed = clear_seed_jobs(db)
            print(f"Removed {removed} previously seeded jobs.")

        companies = ensure_companies(db)
        print(f"Upserted {len(companies)} companies with logos.")

        rng = random.Random(42)
        jobs = generate_jobs(db, companies, rng=rng)
        print(f"Created {len(jobs)} open Indian job postings (currency=INR).")

        by_city: dict[str, int] = {}
        by_role: dict[str, int] = {}
        for job in jobs:
            by_city[job.location or ""] = by_city.get(job.location or "", 0) + 1
            by_role[job.title] = by_role.get(job.title, 0) + 1

        print("By location:")
        for city, count in sorted(by_city.items()):
            print(f"  {city}: {count}")
        print("By role:")
        for title, count in sorted(by_role.items()):
            print(f"  {title}: {count}")
        print("STATUS: SEEDED")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Indian job postings")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete previous indian_jobs_v1 seed jobs and recreate",
    )
    args = parser.parse_args()
    seed(force=args.force)


if __name__ == "__main__":
    main()
