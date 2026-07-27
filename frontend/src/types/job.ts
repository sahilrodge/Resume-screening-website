export type JobStatus = "draft" | "open" | "closed" | "filled"

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "remote"

export type Job = {
  id: string
  company_id: string
  company_name: string | null
  company_logo_url?: string | null
  recruiter_id: string | null
  recruiter_name: string | null
  title: string
  description: string
  location: string | null
  employment_type: EmploymentType
  status: JobStatus
  salary_min: number | null
  salary_max: number | null
  currency: string
  experience_min_years: number | null
  experience_max_years: number | null
  openings: number
  application_count: number
  skills?: string[]
  published_at: string | null
  closes_at: string | null
  created_at: string
  updated_at: string
}

export type JobSortField =
  | "created_at"
  | "title"
  | "status"
  | "location"
  | "employment_type"
  | "published_at"
  | "application_count"

export type SortOrder = "asc" | "desc"

export type JobListParams = {
  page?: number
  page_size?: number
  search?: string
  status?: JobStatus
  employment_type?: EmploymentType
  location?: string
  company_id?: string
  recruiter_id?: string
  sort_by?: JobSortField
  sort_order?: SortOrder
}

export type JobListResponse = {
  items: Job[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type JobDashboardStats = {
  total_jobs: number
  open_jobs: number
  draft_jobs: number
  closed_jobs: number
  filled_jobs: number
  total_applications: number
}

export type JobCreatePayload = {
  company_id: string
  recruiter_id?: string | null
  title: string
  description: string
  location?: string
  employment_type?: EmploymentType
  status?: JobStatus
  salary_min?: number
  salary_max?: number
  currency?: string
  experience_min_years?: number
  experience_max_years?: number
  openings?: number
}

export type JobUpdatePayload = {
  company_id?: string
  recruiter_id?: string | null
  title?: string
  description?: string
  location?: string | null
  employment_type?: EmploymentType
  status?: JobStatus
  salary_min?: number | null
  salary_max?: number | null
  currency?: string
  experience_min_years?: number | null
  experience_max_years?: number | null
  openings?: number
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  remote: "Remote",
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  filled: "Filled",
}
