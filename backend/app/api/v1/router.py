"""Aggregate API v1 routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    applications,
    assistant,
    auth,
    candidates,
    companies,
    health,
    interviews,
    jobs,
    notifications,
    resumes,
    voice_calls,
    whatsapp,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(analytics.router)
api_router.include_router(applications.router)
api_router.include_router(assistant.router)
api_router.include_router(candidates.router)
api_router.include_router(companies.router)
api_router.include_router(interviews.router)
api_router.include_router(jobs.router)
api_router.include_router(notifications.router)
api_router.include_router(resumes.router)
api_router.include_router(voice_calls.router)
api_router.include_router(whatsapp.router)
