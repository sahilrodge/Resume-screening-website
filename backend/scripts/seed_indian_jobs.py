"""Seed 100 realistic Indian job postings across major tech companies.

Usage (from backend/):
  python -m scripts.seed_indian_jobs
  python -m scripts.seed_indian_jobs --force   # replace previous seed jobs
  python -m scripts.seed_indian_jobs --if-empty
"""

from __future__ import annotations

import argparse
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select

from app.core.security import hash_password
from app.crud.skill import skill as skill_crud
from app.database.session import SessionLocal
from app.models.company import Company
from app.models.enums import EmploymentType, JobStatus, SkillLevel, UserRole
from app.models.job import Job
from app.models.recruiter import Recruiter
from app.models.skill import JobSkill
from app.models.user import User

SEED_TAG = "<!-- seed:indian_jobs_v2 -->"
SEED_TAGS_LEGACY = ("<!-- seed:indian_jobs_v1 -->", SEED_TAG)
TARGET_JOB_COUNT = 100

COMPANIES: list[dict[str, str]] = [
    {
        "name": "TCS",
        "website": "https://www.tcs.com",
        "industry": "IT Services",
        "location": "Mumbai",
        "domain": "tcs.com",
        "description": "Tata Consultancy Services — India's largest IT services and consulting firm.",
        "recruiter": "Priya Sharma",
    },
    {
        "name": "Infosys",
        "website": "https://www.infosys.com",
        "industry": "IT Services",
        "location": "Bangalore",
        "domain": "infosys.com",
        "description": "Infosys — global digital services and consulting leader headquartered in Bengaluru.",
        "recruiter": "Rahul Menon",
    },
    {
        "name": "Wipro",
        "website": "https://www.wipro.com",
        "industry": "IT Services",
        "location": "Bangalore",
        "domain": "wipro.com",
        "description": "Wipro Limited — multinational technology consulting and business process services company.",
        "recruiter": "Ananya Iyer",
    },
    {
        "name": "Accenture",
        "website": "https://www.accenture.com/in-en",
        "industry": "Consulting",
        "location": "Bangalore",
        "domain": "accenture.com",
        "description": "Accenture India — strategy, consulting, digital, technology, and operations services.",
        "recruiter": "Vikram Singh",
    },
    {
        "name": "Deloitte",
        "website": "https://www2.deloitte.com/in",
        "industry": "Consulting",
        "location": "Hyderabad",
        "domain": "deloitte.com",
        "description": "Deloitte India — audit, consulting, financial advisory, risk, and tax services.",
        "recruiter": "Sneha Reddy",
    },
    {
        "name": "Capgemini",
        "website": "https://www.capgemini.com/in-en",
        "industry": "IT Services",
        "location": "Mumbai",
        "domain": "capgemini.com",
        "description": "Capgemini India — engineering, technology, and digital transformation partner.",
        "recruiter": "Arjun Nair",
    },
    {
        "name": "Cognizant",
        "website": "https://www.cognizant.com/in/en",
        "industry": "IT Services",
        "location": "Chennai",
        "domain": "cognizant.com",
        "description": "Cognizant — IT services and digital engineering with large delivery centres across India.",
        "recruiter": "Meera Krishnan",
    },
    {
        "name": "IBM India",
        "website": "https://www.ibm.com/in-en",
        "industry": "Technology",
        "location": "Bangalore",
        "domain": "ibm.com",
        "description": "IBM India — hybrid cloud, AI, and enterprise software research and delivery hub.",
        "recruiter": "Karan Malhotra",
    },
    {
        "name": "HCL",
        "website": "https://www.hcltech.com",
        "industry": "IT Services",
        "location": "Noida",
        "domain": "hcltech.com",
        "description": "HCLTech — global technology company offering digital, engineering, and cloud services.",
        "recruiter": "Neha Gupta",
    },
    {
        "name": "Tech Mahindra",
        "website": "https://www.techmahindra.com",
        "industry": "IT Services",
        "location": "Pune",
        "domain": "techmahindra.com",
        "description": "Tech Mahindra — digital transformation, telecom, and enterprise IT services.",
        "recruiter": "Siddharth Joshi",
    },
    {
        "name": "PhonePe",
        "website": "https://www.phonepe.com",
        "industry": "Fintech",
        "location": "Bangalore",
        "domain": "phonepe.com",
        "description": "PhonePe — India's leading digital payments and financial services platform.",
        "recruiter": "Aisha Khan",
    },
    {
        "name": "Razorpay",
        "website": "https://razorpay.com",
        "industry": "Fintech",
        "location": "Bangalore",
        "domain": "razorpay.com",
        "description": "Razorpay — full-stack payments and banking platform for Indian businesses.",
        "recruiter": "Rohan Desai",
    },
    {
        "name": "Groww",
        "website": "https://groww.in",
        "industry": "Fintech",
        "location": "Bangalore",
        "domain": "groww.in",
        "description": "Groww — investment platform for stocks, mutual funds, and digital gold.",
        "recruiter": "Ishita Banerjee",
    },
    {
        "name": "Swiggy",
        "website": "https://www.swiggy.com",
        "industry": "Consumer Internet",
        "location": "Bangalore",
        "domain": "swiggy.com",
        "description": "Swiggy — food delivery, quick commerce, and dining platform.",
        "recruiter": "Aditya Rao",
    },
    {
        "name": "Zomato",
        "website": "https://www.zomato.com",
        "industry": "Consumer Internet",
        "location": "Gurgaon",
        "domain": "zomato.com",
        "description": "Zomato — food delivery and restaurant discovery platform.",
        "recruiter": "Pooja Chauhan",
    },
    {
        "name": "Amazon India",
        "website": "https://www.amazon.in",
        "industry": "E-commerce",
        "location": "Hyderabad",
        "domain": "amazon.in",
        "description": "Amazon India — e-commerce, AWS, and device operations across India.",
        "recruiter": "Nikhil Verma",
    },
    {
        "name": "Flipkart",
        "website": "https://www.flipkart.com",
        "industry": "E-commerce",
        "location": "Bangalore",
        "domain": "flipkart.com",
        "description": "Flipkart — India's leading e-commerce marketplace.",
        "recruiter": "Kavya Pillai",
    },
    {
        "name": "Google India",
        "website": "https://careers.google.com/locations/india/",
        "industry": "Technology",
        "location": "Bangalore",
        "domain": "google.com",
        "description": "Google India — search, ads, Android, Cloud, and AI research & engineering.",
        "recruiter": "Devansh Mehta",
    },
    {
        "name": "Microsoft India",
        "website": "https://www.microsoft.com/en-in",
        "industry": "Technology",
        "location": "Hyderabad",
        "domain": "microsoft.com",
        "description": "Microsoft India — cloud, productivity, and AI product engineering.",
        "recruiter": "Shreya Patil",
    },
    {
        "name": "Zoho",
        "website": "https://www.zoho.com",
        "industry": "SaaS",
        "location": "Chennai",
        "domain": "zoho.com",
        "description": "Zoho Corporation — Indian SaaS product company building business productivity software.",
        "recruiter": "Harish Subramanian",
    },
]

ROLES: list[dict] = [
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
        "title": "Data Scientist",
        "skills": ["Python", "Machine Learning", "SQL", "Statistics", "Pandas", "Experiment Design"],
        "exp": (2, 6),
        "salary_lpa": (12, 35),
        "summary": "Apply statistical modelling and ML to solve forecasting, personalisation, and risk problems.",
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
        "title": "Python Developer",
        "skills": ["Python", "Django", "FastAPI", "PostgreSQL", "Celery", "REST APIs", "Unit Testing"],
        "exp": (1, 5),
        "salary_lpa": (8, 20),
        "summary": "Develop robust Python services, APIs, and automation used across product and platform teams.",
    },
    {
        "title": "DevOps Engineer",
        "skills": ["AWS", "Kubernetes", "Docker", "Terraform", "CI/CD", "Linux", "Monitoring"],
        "exp": (2, 7),
        "salary_lpa": (10, 28),
        "summary": "Own cloud infrastructure, CI/CD, and reliability for large-scale production systems.",
    },
    {
        "title": "QA Automation Engineer",
        "skills": ["Selenium", "Playwright", "Java", "Python", "API Testing", "TestNG", "CI/CD"],
        "exp": (1, 5),
        "salary_lpa": (6, 16),
        "summary": "Design automated test suites that protect release quality across web and API surfaces.",
    },
    {
        "title": "Product Manager",
        "skills": ["Product Strategy", "Roadmapping", "SQL", "A/B Testing", "User Research", "Agile"],
        "exp": (3, 8),
        "salary_lpa": (18, 45),
        "summary": "Define product vision, prioritise roadmaps, and ship customer outcomes with cross-functional teams.",
    },
    {
        "title": "Android Developer",
        "skills": ["Kotlin", "Java", "Android SDK", "Jetpack", "REST APIs", "Firebase"],
        "exp": (1, 5),
        "salary_lpa": (8, 22),
        "summary": "Build high-quality Android apps used daily by Indian consumers at massive scale.",
    },
    {
        "title": "iOS Developer",
        "skills": ["Swift", "UIKit", "SwiftUI", "Xcode", "REST APIs", "Core Data"],
        "exp": (1, 5),
        "salary_lpa": (8, 22),
        "summary": "Deliver polished iOS experiences with strong performance and accessibility standards.",
    },
    {
        "title": "Cloud Engineer",
        "skills": ["AWS", "Azure", "GCP", "Networking", "Security", "Infrastructure as Code"],
        "exp": (2, 6),
        "salary_lpa": (10, 26),
        "summary": "Design and operate secure multi-cloud platforms for enterprise and product workloads.",
    },
    {
        "title": "Cybersecurity Analyst",
        "skills": ["SIEM", "Network Security", "Vulnerability Assessment", "Python", "Incident Response"],
        "exp": (2, 6),
        "salary_lpa": (9, 24),
        "summary": "Protect applications and infrastructure through monitoring, hardening, and incident response.",
    },
    {
        "title": "UI/UX Designer",
        "skills": ["Figma", "User Research", "Prototyping", "Design Systems", "Wireframing"],
        "exp": (1, 5),
        "salary_lpa": (7, 20),
        "summary": "Design intuitive digital experiences grounded in research and scalable design systems.",
    },
    {
        "title": "SRE",
        "skills": ["SRE", "Kubernetes", "Observability", "Python", "SLO", "Incident Management"],
        "exp": (3, 8),
        "salary_lpa": (18, 40),
        "summary": "Improve service reliability with SLOs, automation, and world-class incident practices.",
    },
    {
        "title": "Solution Architect",
        "skills": ["Solution Design", "Microservices", "Cloud Architecture", "Integration", "Stakeholder Management"],
        "exp": (6, 12),
        "salary_lpa": (25, 55),
        "summary": "Architect end-to-end solutions that balance scalability, cost, and delivery speed for clients.",
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
    "Kolkata",
    "Ahmedabad",
    "Kochi",
]

EMPLOYMENT_MIX = [
    EmploymentType.FULL_TIME,
    EmploymentType.FULL_TIME,
    EmploymentType.FULL_TIME,
    EmploymentType.FULL_TIME,
    EmploymentType.CONTRACT,
    EmploymentType.REMOTE,
    EmploymentType.INTERNSHIP,
    EmploymentType.PART_TIME,
]


def logo_url(domain: str) -> str | None:
    # HirePulse uses the app brand mark in the UI — do not seed external logos.
    return None


EMPLOYEE_COUNTS: dict[str, str] = {
    "TCS": "600,000+",
    "Infosys": "250,000+",
    "Wipro": "230,000+",
    "Accenture": "700,000+",
    "Deloitte": "450,000+",
    "Capgemini": "340,000+",
    "Cognizant": "340,000+",
    "IBM India": "100,000+",
    "HCLTech": "220,000+",
    "Tech Mahindra": "150,000+",
    "Paytm": "10,000+",
    "PhonePe": "5,000+",
    "Razorpay": "3,000+",
    "Flipkart": "30,000+",
    "Swiggy": "8,000+",
    "Amazon India": "100,000+",
    "Google India": "5,000+",
    "Microsoft India": "15,000+",
    "Zoho": "15,000+",
}

DEFAULT_BENEFITS = [
    "Health insurance for employee and family",
    "Flexible / hybrid work options",
    "Learning & certification budget",
    "Performance bonus",
    "Paid time off and parental leave",
    "Employee stock / ESOP (role dependent)",
]


def company_culture(name: str, industry: str) -> str:
    return (
        f"{name} fosters a collaborative, learning-first culture across its {industry} teams. "
        "Engineers ship in small squads, mentor juniors, and take ownership of customer outcomes "
        "while balancing delivery quality with sustainable pace."
    )


def company_social(domain: str, name: str) -> dict[str, str]:
    slug = (
        name.lower()
        .replace(" ", "-")
        .replace(".", "")
        .replace("&", "and")
    )
    return {
        "linkedin": f"https://www.linkedin.com/company/{slug}",
        "twitter": f"https://twitter.com/{slug.replace('-', '')}",
        "website": f"https://www.{domain}",
        "youtube": f"https://www.youtube.com/results?search_query={name.replace(' ', '+')}",
    }


def apply_company_profile(company: Company, item: dict[str, str]) -> None:
    company.website = item["website"]
    company.industry = item["industry"]
    company.location = item["location"]
    company.description = item["description"]
    company.logo_url = logo_url(item["domain"])
    company.employee_count = EMPLOYEE_COUNTS.get(item["name"], "1,000+")
    company.culture = company_culture(item["name"], item["industry"])
    company.benefits = list(DEFAULT_BENEFITS)
    company.social_links = company_social(item["domain"], item["name"])


def enrich_all_company_profiles(db) -> int:
    """Fill missing profile fields for every company (safe to run on startup)."""
    updated = 0
    companies = list(db.scalars(select(Company)).all())
    seed_by_name = {item["name"]: item for item in COMPANIES}
    for company in companies:
        item = seed_by_name.get(company.name)
        changed = False
        if item:
            before = (
                company.employee_count,
                company.culture,
                bool(company.benefits),
                bool(company.social_links),
                company.logo_url,
            )
            apply_company_profile(company, item)
            after = (
                company.employee_count,
                company.culture,
                bool(company.benefits),
                bool(company.social_links),
                company.logo_url,
            )
            if before != after:
                changed = True
        else:
            if not company.employee_count:
                company.employee_count = "1,000+"
                changed = True
            if not company.culture:
                company.culture = company_culture(
                    company.name, company.industry or "technology"
                )
                changed = True
            if not company.benefits:
                company.benefits = list(DEFAULT_BENEFITS)
                changed = True
            if not company.social_links:
                domain = (company.website or "example.com").replace("https://", "").replace(
                    "http://", ""
                ).split("/")[0]
                company.social_links = {
                    "linkedin": f"https://www.linkedin.com/company/{company.name.lower().replace(' ', '-')}",
                    "website": company.website,
                }
                if domain and "example.com" not in domain:
                    company.social_links["twitter"] = (
                        f"https://twitter.com/{domain.split('.')[0]}"
                    )
                changed = True
        if changed:
            db.add(company)
            updated += 1
    if updated:
        db.commit()
    return updated


def lpa_to_inr(lpa: float) -> float:
    return round(lpa * 100_000, 2)


def recruiter_email(company_name: str) -> str:
    slug = (
        company_name.lower()
        .replace(" ", "")
        .replace(".", "")
        .replace("&", "and")
    )
    return f"seed.recruiter.{slug}@hirepulse.local"


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
    recruiter_name: str,
    closes_at: datetime,
) -> str:
    emp = employment.value.replace("_", " ")
    deadline = closes_at.strftime("%d %b %Y")
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
INR {salary_min / 100000:.1f}–{salary_max / 100000:.1f} LPA (CTC) depending on experience and interview performance.
Employment type: {emp.title()}. Location: {location} (hybrid/onsite as per team policy).

Recruiter
Contact: {recruiter_name} ({company} Talent Acquisition)

Apply by
Applications close on {deadline}.

Why join {company}
Work on large-scale Indian technology problems with strong mentorship, learning budget, and clear growth paths.

{SEED_TAG}
"""


def ensure_companies(db) -> dict[str, Company]:
    by_name: dict[str, Company] = {}
    for item in COMPANIES:
        existing = db.scalar(select(Company).where(Company.name == item["name"]))
        if existing:
            apply_company_profile(existing, item)
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
                employee_count=EMPLOYEE_COUNTS.get(item["name"], "1,000+"),
                culture=company_culture(item["name"], item["industry"]),
                benefits=list(DEFAULT_BENEFITS),
                social_links=company_social(item["domain"], item["name"]),
            )
            db.add(company)
            db.flush()
            by_name[item["name"]] = company
    db.commit()
    enrich_all_company_profiles(db)
    for name, company in list(by_name.items()):
        by_name[name] = db.get(Company, company.id)  # type: ignore[assignment]
    return by_name


def ensure_recruiters(db, companies: dict[str, Company]) -> dict[str, Recruiter]:
    """Create one recruiter user per company with a realistic Indian name."""
    by_company: dict[str, Recruiter] = {}
    password_hash = hash_password("SeedRecruiter123!")

    for item in COMPANIES:
        company = companies[item["name"]]
        email = recruiter_email(item["name"])
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                hashed_password=password_hash,
                full_name=item["recruiter"],
                role=UserRole.RECRUITER,
                is_active=True,
            )
            db.add(user)
            db.flush()
        else:
            user.full_name = item["recruiter"]
            user.role = UserRole.RECRUITER
            user.is_active = True
            db.add(user)

        recruiter = db.scalar(select(Recruiter).where(Recruiter.user_id == user.id))
        if recruiter is None:
            recruiter = Recruiter(
                user_id=user.id,
                company_id=company.id,
                phone=f"+91 98{abs(hash(item['name'])) % 10_000_000:07d}"[:14],
                job_title="Talent Acquisition Partner",
                department="Human Resources",
            )
            db.add(recruiter)
            db.flush()
        else:
            recruiter.company_id = company.id
            recruiter.job_title = "Talent Acquisition Partner"
            recruiter.department = "Human Resources"
            db.add(recruiter)

        by_company[item["name"]] = recruiter

    db.commit()
    for name, recruiter in list(by_company.items()):
        refreshed = db.get(Recruiter, recruiter.id)
        by_company[name] = refreshed  # type: ignore[assignment]
    return by_company


def count_seed_jobs(db) -> int:
    total = 0
    seen: set = set()
    for tag in SEED_TAGS_LEGACY:
        # Match on the stable token (avoid SQL '--' comment pitfalls in some drivers)
        token = tag.replace("<!-- ", "").replace(" -->", "")
        rows = list(db.scalars(select(Job.id).where(Job.description.contains(token))).all())
        for job_id in rows:
            if job_id not in seen:
                seen.add(job_id)
                total += 1
    return total


def clear_seed_jobs(db) -> int:
    ids: list = []
    seen: set = set()
    for tag in SEED_TAGS_LEGACY:
        token = tag.replace("<!-- ", "").replace(" -->", "")
        rows = list(db.scalars(select(Job.id).where(Job.description.contains(token))).all())
        for job_id in rows:
            if job_id in seen:
                continue
            seen.add(job_id)
            ids.append(job_id)
    if not ids:
        return 0
    db.execute(delete(JobSkill).where(JobSkill.job_id.in_(ids)))
    db.execute(delete(Job).where(Job.id.in_(ids)))
    db.commit()
    return len(ids)


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


def generate_jobs(
    db,
    companies: dict[str, Company],
    recruiters: dict[str, Recruiter],
    *,
    rng: random.Random,
    count: int = TARGET_JOB_COUNT,
) -> list[Job]:
    """Generate `count` jobs (default 100 = 20 companies × 5 roles)."""
    now = datetime.now(timezone.utc)
    created: list[Job] = []
    company_list = list(COMPANIES)
    slots_per_company = max(1, count // len(company_list))

    for company_idx, company_meta in enumerate(company_list):
        company = companies[company_meta["name"]]
        recruiter = recruiters[company_meta["name"]]
        for slot in range(slots_per_company):
            role_idx = (company_idx * slots_per_company + slot) % len(ROLES)
            role = ROLES[role_idx]
            location = LOCATIONS[(company_idx + slot * 2) % len(LOCATIONS)]
            # Prefer HQ location for some postings
            if slot == 0:
                location = company_meta["location"]
            employment = EMPLOYMENT_MIX[(company_idx + slot) % len(EMPLOYMENT_MIX)]

            exp_min, exp_max = role["exp"]
            if rng.random() < 0.35 and exp_min > 0:
                exp_min = max(0, exp_min - 1)
            if rng.random() < 0.35:
                exp_max = exp_max + 1

            sal_lo, sal_hi = role["salary_lpa"]
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
            if employment == EmploymentType.PART_TIME:
                salary_min = round(salary_min * 0.55, 2)
                salary_max = round(salary_max * 0.55, 2)

            skills = list(role["skills"])
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
            recruiter_name = company_meta["recruiter"]

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
                recruiter_name=recruiter_name,
                closes_at=closes_at,
            )

            job = Job(
                company_id=company.id,
                recruiter_id=recruiter.id if recruiter else None,
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
                published_at=now - timedelta(days=rng.randint(0, 21)),
                closes_at=closes_at,
            )
            db.add(job)
            db.flush()
            attach_skills(db, job, skills)
            created.append(job)

    db.commit()
    return created


def seed(*, force: bool = False, if_empty: bool = False) -> int:
    """Seed jobs. Returns number of jobs created (0 if skipped)."""
    db = SessionLocal()
    try:
        total_jobs = db.scalar(select(func.count()).select_from(Job)) or 0
        existing_seed = count_seed_jobs(db)

        if if_empty and total_jobs > 0:
            print(f"Jobs already exist ({total_jobs}). Skipping seed (--if-empty).")
            return 0

        if existing_seed and not force and not if_empty:
            print(
                f"Seed already present ({existing_seed} jobs). Use --force to replace."
            )
            return 0

        if force or existing_seed:
            removed = clear_seed_jobs(db)
            if removed:
                print(f"Removed {removed} previously seeded jobs.")

        companies = ensure_companies(db)
        print(f"Upserted {len(companies)} companies with logos.")

        recruiters = ensure_recruiters(db, companies)
        print(f"Upserted {len(recruiters)} recruiters.")

        rng = random.Random(42)
        jobs = generate_jobs(
            db, companies, recruiters, rng=rng, count=TARGET_JOB_COUNT
        )
        print(f"Created {len(jobs)} open Indian job postings (currency=INR).")

        by_city: dict[str, int] = {}
        by_role: dict[str, int] = {}
        by_company: dict[str, int] = {}
        for job in jobs:
            by_city[job.location or ""] = by_city.get(job.location or "", 0) + 1
            by_role[job.title] = by_role.get(job.title, 0) + 1
            company_name = next(
                (c["name"] for c in COMPANIES if companies[c["name"]].id == job.company_id),
                "?",
            )
            by_company[company_name] = by_company.get(company_name, 0) + 1

        print("By company:")
        for name, count in sorted(by_company.items()):
            print(f"  {name}: {count}")
        print("By location:")
        for city, count in sorted(by_city.items()):
            print(f"  {city}: {count}")
        print("By role:")
        for title, count in sorted(by_role.items()):
            print(f"  {title}: {count}")
        print("STATUS: SEEDED")
        return len(jobs)
    finally:
        db.close()


def seed_if_empty() -> int:
    """Used by app startup: insert seed jobs only when the jobs table is empty."""
    db = SessionLocal()
    try:
        enrich_all_company_profiles(db)
    finally:
        db.close()
    return seed(if_empty=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed 100 Indian job postings")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete previous indian job seeds and recreate",
    )
    parser.add_argument(
        "--if-empty",
        action="store_true",
        help="Only seed when the jobs table has zero rows",
    )
    args = parser.parse_args()
    seed(force=args.force, if_empty=args.if_empty)


if __name__ == "__main__":
    main()
