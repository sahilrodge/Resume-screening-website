"""Company endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBSession, RecruiterUser
from app.schemas.company import (
    CompanyCreate,
    CompanyListResponse,
    CompanyProfileResponse,
    CompanyResponse,
    CompanyUpdate,
)
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
    _: CurrentUser,
    page_size: Annotated[int, Query(ge=1, le=200)] = 100,
) -> CompanyListResponse:
    return company_service.list(db, page_size=page_size)


@router.get(
    "/{company_id}",
    response_model=CompanyProfileResponse,
    summary="Get company profile with open jobs",
)
def get_company(
    company_id: uuid.UUID,
    db: DBSession,
    _: CurrentUser,
) -> CompanyProfileResponse:
    return company_service.get_profile(db, company_id)


@router.patch(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Update company profile",
)
def update_company(
    company_id: uuid.UUID,
    payload: CompanyUpdate,
    db: DBSession,
    current_user: RecruiterUser,
) -> CompanyResponse:
    from app.core.tenancy import assert_can_manage_company

    assert_can_manage_company(db, current_user, company_id)
    return company_service.update(db, company_id, data=payload)
