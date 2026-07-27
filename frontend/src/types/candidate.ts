export type EducationItem = {
  institution: string | null
  degree: string | null
  field: string | null
  start_date: string | null
  end_date: string | null
}

export type ExperienceItem = {
  company: string | null
  title: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
}

export type ProjectItem = {
  name: string | null
  description: string | null
  technologies: string[]
}

export type ParsedResumeData = {
  name: string | null
  email: string | null
  phone: string | null
  education: EducationItem[]
  experience: ExperienceItem[]
  skills: string[]
  projects: ProjectItem[]
}

export type Candidate = {
  id: string
  user_id: string
  email: string
  full_name: string
  is_active: boolean
  phone: string | null
  location: string | null
  headline: string | null
  summary: string | null
  years_experience: number | null
  linkedin_url: string | null
  portfolio_url: string | null
  current_title: string | null
  created_at: string
  updated_at: string
}

export type CandidateProfile = Candidate & {
  skills: string[]
  resume_id: string | null
  resume_status: string | null
  parsed_data: ParsedResumeData | null
}

export type CandidateSortField =
  | "created_at"
  | "full_name"
  | "email"
  | "years_experience"
  | "location"
  | "current_title"

export type SortOrder = "asc" | "desc"

export type CandidateListParams = {
  page?: number
  page_size?: number
  search?: string
  location?: string
  min_experience?: number
  max_experience?: number
  is_active?: boolean
  sort_by?: CandidateSortField
  sort_order?: SortOrder
}

export type CandidateListResponse = {
  items: Candidate[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type CandidateCreatePayload = {
  email: string
  password: string
  full_name: string
  phone?: string
  location?: string
  headline?: string
  summary?: string
  years_experience?: number
  linkedin_url?: string
  portfolio_url?: string
  current_title?: string
}

export type CandidateUpdatePayload = {
  full_name?: string
  phone?: string | null
  location?: string | null
  headline?: string | null
  summary?: string | null
  years_experience?: number | null
  linkedin_url?: string | null
  portfolio_url?: string | null
  current_title?: string | null
  is_active?: boolean
}
