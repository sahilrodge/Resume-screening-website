import { apiClient } from "@/lib/api"
import type { ApplicationStatus } from "@/types/application"

export const INTERVIEW_STATUSES = [
  "scheduled",
  "confirmed",
  "rescheduled",
  "in_progress",
  "completed",
  "selected",
  "rejected",
  "cancelled",
  "no_show",
] as const

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number]

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  in_progress: "In Progress",
  completed: "Completed",
  selected: "Selected",
  rejected: "Rejected",
  cancelled: "Cancelled",
  no_show: "No Show",
}

export type InterviewTimelineStep = {
  key: string
  label: string
  completed: boolean
  current: boolean
  at: string | null
}

export type Interview = {
  id: string
  application_id: string
  candidate_id: string | null
  candidate_name: string | null
  job_title: string | null
  company_name: string | null
  interviewer_id: string | null
  interview_type: "phone" | "video" | "onsite"
  status: InterviewStatus
  /** Synced application pipeline status (source of truth for app badges). */
  application_status?: ApplicationStatus | null
  scheduled_at: string
  duration_minutes: number
  meeting_link: string | null
  location: string | null
  status_changed_at?: string | null
  status_history?: { status: string; at: string }[]
  timeline?: InterviewTimelineStep[]
  created_at: string
  updated_at: string
}

export type InterviewCreatePayload = {
  application_id: string
  scheduled_at: string
  interview_type?: "phone" | "video" | "onsite"
  duration_minutes?: number
  meeting_link?: string
  location?: string
}

export const interviewsApi = {
  list(params?: { page?: number; page_size?: number; application_id?: string }) {
    return apiClient.get<{ items: Interview[]; total: number }>("/interviews", {
      params,
    })
  },

  mine(params?: { page?: number; page_size?: number }) {
    return apiClient.get<{ items: Interview[]; total: number }>("/interviews/me", {
      params,
    })
  },

  create(payload: InterviewCreatePayload) {
    return apiClient.post<Interview>("/interviews", payload)
  },

  get(id: string) {
    return apiClient.get<Interview>(`/interviews/${id}`)
  },

  updateStatus(id: string, payload: { status: InterviewStatus }) {
    return apiClient.patch<Interview>(`/interviews/${id}/status`, payload)
  },
}
