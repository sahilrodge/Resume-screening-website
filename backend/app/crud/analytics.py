"""Analytics aggregations for the recruiter dashboard."""

from __future__ import annotations

from calendar import month_abbr
from datetime import datetime, timezone

from sqlalchemy import case, cast, extract, func, select
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.types import Float

from app.models.application import Application
from app.models.enums import (
    ApplicationStatus,
    InterviewStatus,
    InterviewType,
    JobStatus,
)
from app.models.interview import Interview
from app.models.job import Job
from app.models.recruiter import Recruiter

FUNNEL_ORDER = [
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.INTERVIEW_COMPLETED,
    ApplicationStatus.OFFERED,
    ApplicationStatus.SELECTED,
    ApplicationStatus.HIRED,
]

STATUS_LABELS = {
    ApplicationStatus.APPLIED: "Applied",
    ApplicationStatus.SCREENING: "Under Review",
    ApplicationStatus.SHORTLISTED: "Shortlisted",
    ApplicationStatus.INTERVIEW: "Interview Scheduled",
    ApplicationStatus.INTERVIEW_COMPLETED: "Interview Completed",
    ApplicationStatus.OFFERED: "Offered",
    ApplicationStatus.SELECTED: "Selected",
    ApplicationStatus.HIRED: "Hired",
    ApplicationStatus.REJECTED: "Rejected",
    ApplicationStatus.WITHDRAWN: "Withdrawn",
}

INTERVIEW_STATUS_LABELS = {
    InterviewStatus.SCHEDULED: "Scheduled",
    InterviewStatus.CONFIRMED: "Confirmed",
    InterviewStatus.RESCHEDULED: "Rescheduled",
    InterviewStatus.IN_PROGRESS: "In Progress",
    InterviewStatus.COMPLETED: "Completed",
    InterviewStatus.SELECTED: "Selected",
    InterviewStatus.REJECTED: "Rejected",
    InterviewStatus.CANCELLED: "Cancelled",
    InterviewStatus.NO_SHOW: "No Show",
}

INTERVIEW_TYPE_LABELS = {
    InterviewType.PHONE: "Phone",
    InterviewType.VIDEO: "Video",
    InterviewType.ONSITE: "Onsite",
}

MATCH_BUCKETS = [
    ("0-20", 0, 20),
    ("21-40", 21, 40),
    ("41-60", 41, 60),
    ("61-80", 61, 80),
    ("81-100", 81, 100),
]


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _month_label(year: int, month: int) -> str:
    return f"{month_abbr[month]} {str(year)[2:]}"


def _last_n_months(n: int = 6) -> list[tuple[str, str]]:
    """Return [(YYYY-MM, label), ...] oldest → newest."""
    now = datetime.now(timezone.utc)
    # First day of current month
    cursor = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    months: list[tuple[str, str]] = []
    for _ in range(n):
        months.append((_month_key(cursor), _month_label(cursor.year, cursor.month)))
        # step back one month
        if cursor.month == 1:
            cursor = datetime(cursor.year - 1, 12, 1, tzinfo=timezone.utc)
        else:
            cursor = datetime(cursor.year, cursor.month - 1, 1, tzinfo=timezone.utc)
    months.reverse()
    return months


def _window_start(months: int = 6) -> datetime:
    now = datetime.now(timezone.utc)
    first = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    for _ in range(months - 1):
        if first.month == 1:
            first = datetime(first.year - 1, 12, 1, tzinfo=timezone.utc)
        else:
            first = datetime(first.year, first.month - 1, 1, tzinfo=timezone.utc)
    return first


class CRUDAnalytics:
    def overview(self, db: Session, *, months: int = 6) -> dict:
        month_keys = _last_n_months(months)
        since = _window_start(months)

        applications_chart = self._applications_chart(db, month_keys, since)
        hiring_funnel = self._hiring_funnel(db)
        job_performance = self._job_performance(db)
        recruiter_performance = self._recruiter_performance(db)
        match_scores = self._match_scores(db, month_keys, since)
        interview_results = self._interview_results(db)
        monthly_hiring = self._monthly_hiring(db, month_keys, since)
        kpis = self._kpis(db, hiring_funnel, match_scores)

        return {
            "kpis": kpis,
            "applications": applications_chart,
            "hiring_funnel": hiring_funnel,
            "job_performance": job_performance,
            "recruiter_performance": recruiter_performance,
            "match_scores": match_scores,
            "interview_results": interview_results,
            "monthly_hiring": monthly_hiring,
        }

    def _applications_chart(
        self,
        db: Session,
        month_keys: list[tuple[str, str]],
        since: datetime,
    ) -> list[dict]:
        year_col = extract("year", Application.created_at)
        month_col = extract("month", Application.created_at)
        rows = db.execute(
            select(
                year_col.label("y"),
                month_col.label("m"),
                func.count().label("applications"),
                func.count()
                .filter(Application.match_score.isnot(None))
                .label("screened"),
            )
            .where(Application.created_at >= since)
            .group_by("y", "m")
        ).all()

        by_key = {
            f"{int(r.y):04d}-{int(r.m):02d}": {
                "applications": int(r.applications),
                "screened": int(r.screened or 0),
            }
            for r in rows
        }
        return [
            {
                "month": key,
                "label": label,
                "applications": by_key.get(key, {}).get("applications", 0),
                "screened": by_key.get(key, {}).get("screened", 0),
            }
            for key, label in month_keys
        ]

    def _hiring_funnel(self, db: Session) -> dict:
        rows = db.execute(
            select(Application.status, func.count().label("count")).group_by(Application.status)
        ).all()
        counts = {r.status: int(r.count) for r in rows}
        stages = [
            {
                "status": status.value,
                "label": STATUS_LABELS[status],
                "count": counts.get(status, 0),
            }
            for status in FUNNEL_ORDER
        ]
        return {
            "stages": stages,
            "rejected": counts.get(ApplicationStatus.REJECTED, 0),
            "withdrawn": counts.get(ApplicationStatus.WITHDRAWN, 0),
        }

    def _job_performance(self, db: Session, *, limit: int = 12) -> list[dict]:
        interview_sub = (
            select(
                Application.job_id.label("job_id"),
                func.count(Interview.id).label("interviews"),
            )
            .join(Interview, Interview.application_id == Application.id)
            .group_by(Application.job_id)
            .subquery()
        )

        rows = db.execute(
            select(
                Job.id,
                Job.title,
                Job.status,
                Job.openings,
                func.count(Application.id).label("applications"),
                func.avg(cast(Application.match_score, Float)).label("avg_match"),
                func.count()
                .filter(Application.status == ApplicationStatus.HIRED)
                .label("hires"),
                func.coalesce(interview_sub.c.interviews, 0).label("interviews"),
            )
            .outerjoin(Application, Application.job_id == Job.id)
            .outerjoin(interview_sub, interview_sub.c.job_id == Job.id)
            .group_by(Job.id, interview_sub.c.interviews)
            .order_by(func.count(Application.id).desc())
            .limit(limit)
        ).all()

        items: list[dict] = []
        for r in rows:
            openings = int(r.openings or 1)
            hires = int(r.hires or 0)
            items.append(
                {
                    "job_id": r.id,
                    "title": r.title,
                    "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                    "applications": int(r.applications or 0),
                    "avg_match_score": round(float(r.avg_match), 1) if r.avg_match is not None else None,
                    "interviews": int(r.interviews or 0),
                    "hires": hires,
                    "openings": openings,
                    "fill_rate": round(min(hires / openings, 1.0), 2) if openings else 0.0,
                }
            )
        return items

    def _recruiter_performance(self, db: Session, *, limit: int = 10) -> list[dict]:
        recruiters = db.scalars(
            select(Recruiter).options(joinedload(Recruiter.user)).limit(50)
        ).unique().all()

        items: list[dict] = []
        for rec in recruiters:
            job_ids = list(
                db.scalars(select(Job.id).where(Job.recruiter_id == rec.id)).all()
            )
            jobs_owned = len(job_ids)
            open_jobs = (
                db.scalar(
                    select(func.count())
                    .select_from(Job)
                    .where(Job.recruiter_id == rec.id, Job.status == JobStatus.OPEN)
                )
                or 0
            )
            if not job_ids:
                items.append(
                    {
                        "recruiter_id": rec.id,
                        "user_id": rec.user_id,
                        "name": rec.user.full_name if rec.user else "Unknown",
                        "jobs_owned": 0,
                        "open_jobs": int(open_jobs),
                        "applications": 0,
                        "interviews": 0,
                        "hires": 0,
                        "avg_match_score": None,
                        "avg_time_to_hire_days": None,
                    }
                )
                continue

            apps = int(
                db.scalar(
                    select(func.count())
                    .select_from(Application)
                    .where(Application.job_id.in_(job_ids))
                )
                or 0
            )
            hires = int(
                db.scalar(
                    select(func.count())
                    .select_from(Application)
                    .where(
                        Application.job_id.in_(job_ids),
                        Application.status == ApplicationStatus.HIRED,
                    )
                )
                or 0
            )
            avg_match = db.scalar(
                select(func.avg(cast(Application.match_score, Float))).where(
                    Application.job_id.in_(job_ids),
                    Application.match_score.isnot(None),
                )
            )
            interviews = int(
                db.scalar(
                    select(func.count())
                    .select_from(Interview)
                    .join(Application, Application.id == Interview.application_id)
                    .where(Application.job_id.in_(job_ids))
                )
                or 0
            )
            # Time to hire: updated_at - created_at for hired apps
            avg_tth = db.scalar(
                select(
                    func.avg(
                        extract("epoch", Application.updated_at)
                        - extract("epoch", Application.created_at)
                    )
                ).where(
                    Application.job_id.in_(job_ids),
                    Application.status == ApplicationStatus.HIRED,
                )
            )
            avg_days = round(float(avg_tth) / 86400, 1) if avg_tth is not None else None

            items.append(
                {
                    "recruiter_id": rec.id,
                    "user_id": rec.user_id,
                    "name": rec.user.full_name if rec.user else "Unknown",
                    "jobs_owned": jobs_owned,
                    "open_jobs": int(open_jobs),
                    "applications": apps,
                    "interviews": interviews,
                    "hires": hires,
                    "avg_match_score": round(float(avg_match), 1) if avg_match is not None else None,
                    "avg_time_to_hire_days": avg_days,
                }
            )

        items.sort(key=lambda x: x["hires"], reverse=True)
        return items[:limit]

    def _match_scores(
        self,
        db: Session,
        month_keys: list[tuple[str, str]],
        since: datetime,
    ) -> dict:
        scored = int(
            db.scalar(
                select(func.count())
                .select_from(Application)
                .where(Application.match_score.isnot(None))
            )
            or 0
        )
        total = int(db.scalar(select(func.count()).select_from(Application)) or 0)
        avg_score = db.scalar(
            select(func.avg(cast(Application.match_score, Float))).where(
                Application.match_score.isnot(None)
            )
        )

        score = cast(Application.match_score, Float)
        bucket_expr = case(
            (score <= 20, "0-20"),
            (score <= 40, "21-40"),
            (score <= 60, "41-60"),
            (score <= 80, "61-80"),
            else_="81-100",
        )
        bucket_rows = db.execute(
            select(bucket_expr.label("range"), func.count().label("count"))
            .where(Application.match_score.isnot(None))
            .group_by("range")
        ).all()
        bucket_map = {r.range: int(r.count) for r in bucket_rows}
        buckets = [{"range": label, "count": bucket_map.get(label, 0)} for label, _, _ in MATCH_BUCKETS]

        year_col = extract("year", Application.created_at)
        month_col = extract("month", Application.created_at)
        month_rows = db.execute(
            select(
                year_col.label("y"),
                month_col.label("m"),
                func.avg(score).label("avg_score"),
                func.count().label("count"),
            )
            .where(
                Application.match_score.isnot(None),
                Application.created_at >= since,
            )
            .group_by("y", "m")
        ).all()
        by_month_map = {
            f"{int(r.y):04d}-{int(r.m):02d}": {
                "avg_score": round(float(r.avg_score), 1),
                "count": int(r.count),
            }
            for r in month_rows
        }
        by_month = [
            {
                "month": key,
                "label": label,
                "avg_score": by_month_map.get(key, {}).get("avg_score", 0.0),
                "count": by_month_map.get(key, {}).get("count", 0),
            }
            for key, label in month_keys
        ]

        return {
            "avg_score": round(float(avg_score), 1) if avg_score is not None else None,
            "scored_applications": scored,
            "unscored_applications": max(total - scored, 0),
            "buckets": buckets,
            "by_month": by_month,
        }

    def _interview_results(self, db: Session) -> dict:
        status_rows = db.execute(
            select(Interview.status, func.count().label("count")).group_by(Interview.status)
        ).all()
        by_status = [
            {
                "status": (r.status.value if hasattr(r.status, "value") else str(r.status)),
                "label": INTERVIEW_STATUS_LABELS.get(r.status, str(r.status)),
                "count": int(r.count),
            }
            for r in status_rows
        ]

        type_rows = db.execute(
            select(Interview.interview_type, func.count().label("count")).group_by(
                Interview.interview_type
            )
        ).all()
        by_type = [
            {
                "interview_type": (
                    r.interview_type.value
                    if hasattr(r.interview_type, "value")
                    else str(r.interview_type)
                ),
                "label": INTERVIEW_TYPE_LABELS.get(r.interview_type, str(r.interview_type)),
                "count": int(r.count),
            }
            for r in type_rows
        ]

        avg_rating = db.scalar(
            select(func.avg(cast(Interview.rating, Float))).where(Interview.rating.isnot(None))
        )
        rated_count = int(
            db.scalar(
                select(func.count()).select_from(Interview).where(Interview.rating.isnot(None))
            )
            or 0
        )
        rating_rows = db.execute(
            select(Interview.rating, func.count().label("count"))
            .where(Interview.rating.isnot(None))
            .group_by(Interview.rating)
            .order_by(Interview.rating)
        ).all()
        rating_distribution = [
            {"rating": int(r.rating), "count": int(r.count)} for r in rating_rows
        ]

        return {
            "by_status": by_status,
            "by_type": by_type,
            "avg_rating": round(float(avg_rating), 1) if avg_rating is not None else None,
            "rated_count": rated_count,
            "rating_distribution": rating_distribution,
        }

    def _monthly_hiring(
        self,
        db: Session,
        month_keys: list[tuple[str, str]],
        since: datetime,
    ) -> list[dict]:
        year_col = extract("year", Application.created_at)
        month_col = extract("month", Application.created_at)
        app_rows = db.execute(
            select(
                year_col.label("y"),
                month_col.label("m"),
                func.count().label("applications"),
                func.count()
                .filter(Application.status == ApplicationStatus.OFFERED)
                .label("offers"),
                func.count()
                .filter(Application.status == ApplicationStatus.HIRED)
                .label("hires"),
            )
            .where(Application.created_at >= since)
            .group_by("y", "m")
        ).all()
        app_map = {
            f"{int(r.y):04d}-{int(r.m):02d}": {
                "applications": int(r.applications),
                "offers": int(r.offers or 0),
                "hires": int(r.hires or 0),
            }
            for r in app_rows
        }

        # Hires/offers by updated_at for better "when hired" signal
        uy = extract("year", Application.updated_at)
        um = extract("month", Application.updated_at)
        hire_rows = db.execute(
            select(
                uy.label("y"),
                um.label("m"),
                func.count()
                .filter(Application.status == ApplicationStatus.OFFERED)
                .label("offers"),
                func.count()
                .filter(Application.status == ApplicationStatus.HIRED)
                .label("hires"),
            )
            .where(
                Application.updated_at >= since,
                Application.status.in_(
                    [ApplicationStatus.OFFERED, ApplicationStatus.HIRED]
                ),
            )
            .group_by("y", "m")
        ).all()
        hire_map = {
            f"{int(r.y):04d}-{int(r.m):02d}": {
                "offers": int(r.offers or 0),
                "hires": int(r.hires or 0),
            }
            for r in hire_rows
        }

        iy = extract("year", Interview.scheduled_at)
        im = extract("month", Interview.scheduled_at)
        int_rows = db.execute(
            select(
                iy.label("y"),
                im.label("m"),
                func.count().label("interviews"),
            )
            .where(Interview.scheduled_at >= since)
            .group_by("y", "m")
        ).all()
        int_map = {
            f"{int(r.y):04d}-{int(r.m):02d}": int(r.interviews) for r in int_rows
        }

        return [
            {
                "month": key,
                "label": label,
                "applications": app_map.get(key, {}).get("applications", 0),
                "interviews": int_map.get(key, 0),
                "offers": hire_map.get(key, {}).get("offers", 0),
                "hires": hire_map.get(key, {}).get("hires", 0),
            }
            for key, label in month_keys
        ]

    def _kpis(self, db: Session, funnel: dict, match_scores: dict) -> dict:
        total_applications = int(
            db.scalar(select(func.count()).select_from(Application)) or 0
        )
        total_hires = next(
            (s["count"] for s in funnel["stages"] if s["status"] == "hired"), 0
        )
        open_jobs = int(
            db.scalar(
                select(func.count()).select_from(Job).where(Job.status == JobStatus.OPEN)
            )
            or 0
        )
        offered = next(
            (s["count"] for s in funnel["stages"] if s["status"] == "offered"), 0
        )
        # Offer accept ≈ hired / (hired + offered still pending) → hired / (hired+offered) if both
        denom = total_hires + offered
        offer_accept = round(total_hires / denom, 2) if denom else None

        screening = next(
            (s["count"] for s in funnel["stages"] if s["status"] == "screening"), 0
        )
        interview = next(
            (s["count"] for s in funnel["stages"] if s["status"] == "interview"), 0
        )
        # Include shortlisted+interview as progressed; screen-to-interview = interview / screening
        screen_to_interview = (
            round(interview / screening, 2) if screening else None
        )

        avg_tth = db.scalar(
            select(
                func.avg(
                    extract("epoch", Application.updated_at)
                    - extract("epoch", Application.created_at)
                )
            ).where(Application.status == ApplicationStatus.HIRED)
        )
        avg_days = round(float(avg_tth) / 86400, 1) if avg_tth is not None else None

        return {
            "total_applications": total_applications,
            "total_hires": total_hires,
            "open_jobs": open_jobs,
            "avg_match_score": match_scores.get("avg_score"),
            "offer_accept_rate": offer_accept,
            "screen_to_interview_rate": screen_to_interview,
            "avg_time_to_hire_days": avg_days,
        }


analytics = CRUDAnalytics()
