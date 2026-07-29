import type { ParsedResumeData } from "@/types/candidate"

export type ResumeStatus = "uploaded" | "parsing" | "parsed" | "failed"

export type AppliedJobSummary = {
  application_id: string
  job_id: string
  job_title: string
  company_name: string | null
  ats_score: number | null
  match_score: number | null
}

export type Resume = {
  id: string
  candidate_id: string
  candidate_name: string
  candidate_email: string | null
  file_name: string
  file_url: string
  storage_path: string | null
  file_type: string | null
  status: ResumeStatus
  is_primary: boolean
  parsed_data?: ParsedResumeData | null
  parse_error?: string | null
  ats_score?: number | null
  applied_jobs?: AppliedJobSummary[]
  created_at: string
  updated_at: string
}

export type ResumeListResponse = {
  items: Resume[]
  total: number
  page?: number
  page_size?: number
  pages?: number
}

export type ResumePreview = {
  id: string
  file_name: string
  preview_url: string
  download_url: string
  file_type: string | null
}
