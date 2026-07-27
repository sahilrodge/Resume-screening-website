"""Company endpoints (for job company selection)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, RecruiterUser
from app.schemas.company import CompanyCreate, CompanyListResponse, CompanyResponse
from app.services.company import company_service

router = APIRouter(prefix="/companies", tags=["companies"])


@router.post(
    "",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create company",
)
def create_company(
    payload: CompanyCreate,
    db: DBSession,
    _: RecruiterUser,
) -> CompanyResponse:
    return company_service.create(db, data=payload)


@router.get(
    "",
    response_model=CompanyListResponse,
    summary="List companies",
)
def list_companies(
    db: DBSession,
    _: RecruiterUser,
    page_size: Annotated[int, Query(ge=1, le=200)] = 100,
) -> CompanyListResponse:
    return company_service.list(db, page_size=page_size)
