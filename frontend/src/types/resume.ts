import type { ParsedResumeData } from "@/types/candidate"

export type ResumeStatus = "uploaded" | "parsing" | "parsed" | "failed"

export type Resume = {
  id: string
  candidate_id: string
  candidate_name: string | null
  candidate_email: string | null
  file_name: string
  file_url: string
  storage_path: string | null
  file_type: string | null
  status: ResumeStatus
  is_primary: boolean
  parsed_data?: ParsedResumeData | null
  parse_error?: string | null
  created_at: string
  updated_at: string
}

export type ResumeListResponse = {
  items: Resume[]
  total: number
}

export type ResumePreview = {
  id: string
  file_name: string
  preview_url: string
  download_url: string
  file_type: string | null
}
