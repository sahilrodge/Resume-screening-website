export type CompanySocialLinks = {
  linkedin?: string | null
  twitter?: string | null
  facebook?: string | null
  instagram?: string | null
  youtube?: string | null
  github?: string | null
  website?: string | null
  [key: string]: string | null | undefined
}

export type Company = {
  id: string
  name: string
  description: string | null
  website: string | null
  industry: string | null
  location: string | null
  logo_url: string | null
  employee_count?: string | null
  culture?: string | null
  benefits?: string[]
  social_links?: CompanySocialLinks
  open_jobs_count?: number
  created_at: string
  updated_at: string
}

export type CompanyJobSummary = {
  id: string
  title: string
  location: string | null
  employment_type: string
  salary_min: number | null
  salary_max: number | null
  currency: string
  published_at: string | null
  closes_at: string | null
  skills?: string[]
}

export type CompanyProfile = Company & {
  open_jobs: import("@/types/job").Job[]
}

export type CompanyListResponse = {
  items: Company[]
  total: number
}

export type CompanyCreatePayload = {
  name: string
  description?: string
  website?: string
  industry?: string
  location?: string
  logo_url?: string
  employee_count?: string
  culture?: string
  benefits?: string[]
  social_links?: CompanySocialLinks
}

export type CompanyUpdatePayload = Partial<CompanyCreatePayload>
