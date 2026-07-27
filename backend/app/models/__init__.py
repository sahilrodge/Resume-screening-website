"""SQLAlchemy ORM models."""

from app.database.base import Base
from app.models.application import Application
from app.models.assistant import AssistantConversation, AssistantMessage
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.enums import (
    ApplicationStatus,
    ChatRole,
    EmploymentType,
    InterviewStatus,
    InterviewType,
    JobStatus,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
    ResumeStatus,
    SkillLevel,
    UserRole,
    VoiceCallStatus,
    WhatsappDirection,
    WhatsappStatus,
)
from app.models.interview import Interview
from app.models.job import Job
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.push_subscription import PushSubscription
from app.models.recruiter import Recruiter
from app.models.refresh_token import RefreshToken
from app.models.resume import Resume
from app.models.skill import CandidateSkill, JobSkill, Skill
from app.models.user import User
from app.models.voice_call import VoiceCall
from app.models.whatsapp_log import WhatsappLog

__all__ = [
    "Base",
    "User",
    "UserRole",
    "RefreshToken",
    "Company",
    "Candidate",
    "Recruiter",
    "Job",
    "Application",
    "Skill",
    "CandidateSkill",
    "JobSkill",
    "Interview",
    "Resume",
    "WhatsappLog",
    "VoiceCall",
    "Notification",
    "NotificationPreference",
    "PushSubscription",
    "AssistantConversation",
    "AssistantMessage",
    "JobStatus",
    "EmploymentType",
    "ApplicationStatus",
    "InterviewStatus",
    "InterviewType",
    "ResumeStatus",
    "NotificationType",
    "NotificationChannel",
    "NotificationDeliveryStatus",
    "WhatsappDirection",
    "WhatsappStatus",
    "VoiceCallStatus",
    "ChatRole",
    "SkillLevel",
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
]
