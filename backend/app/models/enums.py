"""Shared enumerations for ORM models."""

from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    RECRUITER = "recruiter"
    CANDIDATE = "candidate"


class JobStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"
    FILLED = "filled"


class EmploymentType(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    REMOTE = "remote"


class ApplicationStatus(str, Enum):
    APPLIED = "applied"
    SCREENING = "screening"
    SHORTLISTED = "shortlisted"
    INTERVIEW = "interview"
    OFFERED = "offered"
    REJECTED = "rejected"
    HIRED = "hired"
    WITHDRAWN = "withdrawn"


class InterviewStatus(str, Enum):
    SCHEDULED = "scheduled"
    RESCHEDULED = "rescheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SELECTED = "selected"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class InterviewType(str, Enum):
    PHONE = "phone"
    VIDEO = "video"
    ONSITE = "onsite"


class ResumeStatus(str, Enum):
    UPLOADED = "uploaded"
    PARSING = "parsing"
    PARSED = "parsed"
    FAILED = "failed"


class NotificationType(str, Enum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ALERT = "alert"


class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"


class NotificationDeliveryStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class SkillLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"
