"""WhatsApp message templates for recruitment events."""

from __future__ import annotations

from enum import Enum


class WhatsappEvent(str, Enum):
    APPLICATION_RECEIVED = "application_received"
    INTERVIEW_INVITE = "interview_invite"
    REMINDER = "reminder"
    REJECTED = "rejected"
    SELECTED = "selected"
    INBOUND_REPLY = "inbound_reply"
    MANUAL = "manual"


def build_message(
    event: WhatsappEvent,
    *,
    candidate_name: str,
    job_title: str,
    company_name: str | None = None,
    interview_at: str | None = None,
    meeting_link: str | None = None,
    location: str | None = None,
) -> str:
    company = company_name or "our team"
    name = candidate_name or "there"

    if event == WhatsappEvent.APPLICATION_RECEIVED:
        return (
            f"Hi {name}, thank you for applying for *{job_title}* at {company}. "
            "We have received your application and will review it shortly. "
            "Reply to this chat if you have any questions."
        )

    if event == WhatsappEvent.INTERVIEW_INVITE:
        when = interview_at or "the scheduled time"
        extra = ""
        if meeting_link:
            extra += f"\nMeeting link: {meeting_link}"
        if location:
            extra += f"\nLocation: {location}"
        return (
            f"Hi {name}, congratulations! You are invited to interview for *{job_title}* "
            f"at {company}.\nWhen: {when}{extra}\n"
            "Please reply YES to confirm or suggest another time."
        )

    if event == WhatsappEvent.REMINDER:
        when = interview_at or "soon"
        extra = f"\nMeeting link: {meeting_link}" if meeting_link else ""
        return (
            f"Hi {name}, reminder: your interview for *{job_title}* at {company} "
            f"is scheduled for {when}.{extra}\nSee you there!"
        )

    if event == WhatsappEvent.REJECTED:
        return (
            f"Hi {name}, thank you for your interest in *{job_title}* at {company}. "
            "After careful review, we will not be moving forward at this time. "
            "We appreciate your time and wish you the best."
        )

    if event == WhatsappEvent.SELECTED:
        return (
            f"Hi {name}, great news! You have been *selected* for *{job_title}* "
            f"at {company}. Our team will follow up with next steps shortly. "
            "Congratulations!"
        )

    return f"Hi {name}, you have a new update regarding *{job_title}* at {company}."
