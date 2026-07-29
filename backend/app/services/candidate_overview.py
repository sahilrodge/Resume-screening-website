"""Build the candidate portal sync overview from existing services."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.candidate_overview import CandidateOverviewResponse
from app.services.application import application_service
from app.services.candidate import candidate_service
from app.services.interview import interview_service
from app.services.notification import notification_service
from app.services.profile import profile_service
from app.services.resume import resume_service
from app.services.saved_job import saved_job_service


class CandidateOverviewService:
    def get_overview(self, db: Session, *, user: User) -> CandidateOverviewResponse:
        candidate = candidate_service.get_by_user_id(db, user.id)
        profile = profile_service.get_me(db, user)

        resumes = resume_service.list(
            db, candidate_id=candidate.id, page=1, page_size=20
        )
        applications = application_service.list(
            db, page=1, page_size=100, candidate_id=candidate.id
        )
        saved = saved_job_service.list_mine(
            db, candidate_id=candidate.id, page=1, page_size=100
        )
        saved_ids = saved_job_service.saved_ids(db, candidate_id=candidate.id)
        interviews = interview_service.list_for_candidate(
            db, candidate_id=candidate.id, page=1, page_size=50
        )
        notifications = notification_service.list(
            db, user=user, page=1, page_size=30
        )

        return CandidateOverviewResponse(
            profile=profile,
            resumes=resumes.items,
            resumes_total=resumes.total,
            applications=applications.items,
            applications_total=applications.total,
            saved_jobs=saved.items,
            saved_jobs_total=saved.total,
            saved_job_ids=[str(job_id) for job_id in saved_ids.job_ids],
            interviews=interviews.items,
            interviews_total=interviews.total,
            notifications=notifications.items,
            notifications_total=notifications.total,
            unread_notifications=notifications.unread_count,
        )


candidate_overview_service = CandidateOverviewService()
