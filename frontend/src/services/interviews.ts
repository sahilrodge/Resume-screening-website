import { apiClient } from "@/lib/api"

export type Interview = {
  id: string
  application_id: string
  candidate_id: string | null
  candidate_name: string | null
  job_title: string | null
  company_name: string | null
  interviewer_id: string | null
  interview_type: "phone" | "video" | "onsite" | "ai_voice"
  status: "scheduled" | "completed" | "cancelled" | "no_show" | "rescheduled"
  scheduled_at: string
  duration_minutes: number
  meeting_link: string | null
  location: string | null
  created_at: string
  updated_at: string
}

export type InterviewCreatePayload = {
  application_id: string
  scheduled_at: string
  interview_type?: "phone" | "video" | "onsite" | "ai_voice"
  duration_minutes?: number
  meeting_link?: string
  location?: string
  send_whatsapp?: boolean
}

export const interviewsApi = {
  list(params?: { page?: number; page_size?: number; application_id?: string }) {
    return apiClient.get<{ items: Interview[]; total: number }>("/interviews", { params })
  },

  create(payload: InterviewCreatePayload) {
    return apiClient.post<Interview>("/interviews", payload)
  },

  get(id: string) {
    return apiClient.get<Interview>(`/interviews/${id}`)
  },
}
