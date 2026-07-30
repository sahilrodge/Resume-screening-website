export type ApplicationStatus =
  | "applied"
  | "screening"
  | "shortlisted"
  | "interview"
  | "interview_completed"
  | "offered"
  | "selected"
  | "rejected"
  | "hired"
  | "withdrawn"

export type ApplicationMatch = {
  id: string
  job_id: string
  job_title: string | null
  company_name: string | null
  candidate_id: string
  candidate_name: string | null
  candidate_email: string | null
  resume_id: string | null
  resume_file_name: string | null
  status: ApplicationStatus
  match_score: number | null
  ats_score: number | null
  matching_skills: string[]
  missing_skills: string[]
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  summary: string | null
  reasoning: string | null
  scoring_engine?: "openai" | "local" | null
  confidence?: number | null
  created_at: string
  updated_at: string
}

export type ApplicationListResponse = {
  items: ApplicationMatch[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type ComparePayload = {
  job_id: string
  resume_id: string
}

/** Re-export shared labels so existing imports keep working. */
export {
  APPLICATION_STATUS_LABELS,
  applicationStatusLabel,
} from "@/lib/application-status"
