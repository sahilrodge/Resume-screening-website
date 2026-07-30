import type { ApplicationStatus } from "@/types/application"

/**
 * Single source of truth for application status labels shown across
 * Candidate / Recruiter / Admin dashboards, screening, interviews, and history.
 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  screening: "Under Review",
  shortlisted: "Shortlisted",
  interview: "Interview Scheduled",
  interview_completed: "Interview Completed",
  offered: "Offered",
  selected: "Selected",
  rejected: "Rejected",
  hired: "Hired",
  withdrawn: "Withdrawn",
}

export function applicationStatusLabel(
  status?: string | null
): string {
  if (!status) return "Unknown"
  const key = status.trim().toLowerCase() as ApplicationStatus
  return APPLICATION_STATUS_LABELS[key] ?? status.replaceAll("_", " ")
}

/** Terminal decision statuses — Select/Reject buttons treat these as decided. */
export function isSelectedApplicationStatus(status: string) {
  return status === "selected" || status === "hired" || status === "offered"
}

export function isRejectedApplicationStatus(status: string) {
  return status === "rejected"
}
