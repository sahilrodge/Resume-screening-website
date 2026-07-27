export type VoiceCallStatus =
  | "initiated"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "busy"
  | "cancelled"

export type VoiceCall = {
  id: string
  user_id: string | null
  candidate_id: string | null
  candidate_name: string | null
  application_id: string | null
  job_title: string | null
  to_number: string
  from_number: string
  status: VoiceCallStatus
  provider_call_id: string | null
  duration_seconds: number | null
  recording_url: string | null
  transcript: string | null
  interview_score: number | null
  evaluation_summary: string | null
  recommendation: string | null
  screening_questions: string[]
  started_at: string | null
  ended_at: string | null
  error_message: string | null
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type VoiceCallListResponse = {
  items: VoiceCall[]
  total: number
  page: number
  page_size: number
  pages: number
}
