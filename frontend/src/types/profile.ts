import type { UserRole } from "@/types/auth"
import type { EducationItem, ExperienceItem } from "@/types/candidate"

export type Profile = {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  avatar_url: string | null
  phone: string | null
  location: string | null
  headline: string | null
  summary: string | null
  years_experience: number | null
  current_title: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  skills: string[]
  education: EducationItem[]
  experience: ExperienceItem[]
  resume_id: string | null
  resume_file_name: string | null
  resume_status: string | null
  company_id: string | null
  company_name: string | null
  job_title: string | null
  department: string | null
  created_at: string
  updated_at: string
}

export type ProfileUpdatePayload = {
  full_name?: string
  phone?: string | null
  location?: string | null
  headline?: string | null
  summary?: string | null
  years_experience?: number | null
  current_title?: string | null
  linkedin_url?: string | null
  github_url?: string | null
  portfolio_url?: string | null
  skills?: string[]
  education?: EducationItem[]
  experience?: ExperienceItem[]
  company_name?: string | null
  job_title?: string | null
  department?: string | null
  current_password?: string
  new_password?: string
}
