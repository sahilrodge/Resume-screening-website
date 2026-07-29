import type { EducationItem, ExperienceItem } from "@/types/candidate"
import type { Profile, ProfileUpdatePayload } from "@/types/profile"

export type ProfileDraft = {
  fullName: string
  email: string
  phone: string
  location: string
  dateOfBirth: string
  linkedin: string
  github: string
  portfolio: string
  summary: string
  preferredJobRole: string
  preferredLocation: string
  expectedSalary: string
  skills: string[]
  education: EducationItem[]
  experience: ExperienceItem[]
  companyName: string
  jobTitle: string
}

export type ProfileFieldErrors = Partial<
  Record<
    | "fullName"
    | "email"
    | "phone"
    | "linkedin"
    | "github"
    | "portfolio"
    | "expectedSalary"
    | "dateOfBirth"
    | "currentPassword"
    | "newPassword",
    string
  >
>

const optionalUrl = (value: string, label: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${label} must start with http:// or https://`
    }
    return null
  } catch {
    return `${label} must be a valid URL`
  }
}

export function emptyEducation(): EducationItem {
  return {
    institution: "",
    degree: "",
    field: "",
    start_date: "",
    end_date: "",
  }
}

export function emptyExperience(): ExperienceItem {
  return {
    company: "",
    title: "",
    start_date: "",
    end_date: "",
    description: "",
  }
}

export function draftFromProfile(data: Profile): ProfileDraft {
  return {
    fullName: data.full_name,
    email: data.email,
    phone: data.phone ?? "",
    location: data.location ?? "",
    dateOfBirth: data.date_of_birth ?? "",
    linkedin: data.linkedin_url ?? "",
    github: data.github_url ?? "",
    portfolio: data.portfolio_url ?? "",
    summary: data.summary ?? "",
    preferredJobRole: data.preferred_job_role ?? "",
    preferredLocation: data.preferred_location ?? "",
    expectedSalary:
      data.expected_salary == null || data.expected_salary === ""
        ? ""
        : String(data.expected_salary),
    skills: [...(data.skills ?? [])],
    education: (data.education ?? []).map((item) => ({
      institution: item.institution ?? "",
      degree: item.degree ?? "",
      field: item.field ?? "",
      start_date: item.start_date ?? "",
      end_date: item.end_date ?? "",
    })),
    experience: (data.experience ?? []).map((item) => ({
      company: item.company ?? "",
      title: item.title ?? "",
      start_date: item.start_date ?? "",
      end_date: item.end_date ?? "",
      description: item.description ?? "",
    })),
    companyName: data.company_name ?? "",
    jobTitle: data.job_title ?? "",
  }
}

export function draftsEqual(a: ProfileDraft, b: ProfileDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function validateDraft(
  draft: ProfileDraft,
  role: Profile["role"],
  passwords?: { currentPassword: string; newPassword: string }
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}

  if (!draft.fullName.trim()) {
    errors.fullName = "Name is required"
  }

  const email = draft.email.trim()
  if (!email) {
    errors.email = "Email is required"
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address"
  }

  if (draft.phone.trim().length > 30) {
    errors.phone = "Phone must be 30 characters or fewer"
  }

  if (role === "candidate") {
    const linkedinError = optionalUrl(draft.linkedin, "LinkedIn")
    if (linkedinError) errors.linkedin = linkedinError
    const githubError = optionalUrl(draft.github, "GitHub")
    if (githubError) errors.github = githubError
    const portfolioError = optionalUrl(draft.portfolio, "Portfolio")
    if (portfolioError) errors.portfolio = portfolioError

    if (draft.expectedSalary.trim()) {
      const salary = Number(draft.expectedSalary)
      if (Number.isNaN(salary) || salary < 0) {
        errors.expectedSalary = "Expected salary must be a non-negative number"
      }
    }

    if (draft.dateOfBirth) {
      const dob = new Date(draft.dateOfBirth)
      const today = new Date()
      if (Number.isNaN(dob.getTime())) {
        errors.dateOfBirth = "Enter a valid date"
      } else if (dob > today) {
        errors.dateOfBirth = "Date of birth cannot be in the future"
      } else if (dob.getFullYear() < 1920) {
        errors.dateOfBirth = "Date of birth is unrealistically old"
      }
    }
  }

  if (passwords?.newPassword) {
    if (passwords.newPassword.length < 8) {
      errors.newPassword = "New password must be at least 8 characters"
    }
    if (!passwords.currentPassword) {
      errors.currentPassword = "Current password is required to set a new password"
    }
  }

  return errors
}

export function buildUpdatePayload(
  draft: ProfileDraft,
  role: Profile["role"],
  passwords?: { currentPassword: string; newPassword: string }
): ProfileUpdatePayload {
  const base: ProfileUpdatePayload = {
    full_name: draft.fullName.trim(),
    email: draft.email.trim().toLowerCase(),
  }

  if (passwords?.newPassword) {
    base.current_password = passwords.currentPassword
    base.new_password = passwords.newPassword
  }

  if (role === "candidate") {
    return {
      ...base,
      phone: draft.phone.trim() || null,
      location: draft.location.trim() || null,
      date_of_birth: draft.dateOfBirth.trim() || null,
      summary: draft.summary.trim() || null,
      linkedin_url: draft.linkedin.trim() || null,
      github_url: draft.github.trim() || null,
      portfolio_url: draft.portfolio.trim() || null,
      preferred_job_role: draft.preferredJobRole.trim() || null,
      preferred_location: draft.preferredLocation.trim() || null,
      expected_salary: draft.expectedSalary.trim()
        ? Number(draft.expectedSalary)
        : null,
      skills: draft.skills,
      education: draft.education.map((item) => ({
        institution: (item.institution || "").trim() || null,
        degree: (item.degree || "").trim() || null,
        field: (item.field || "").trim() || null,
        start_date: (item.start_date || "").trim() || null,
        end_date: (item.end_date || "").trim() || null,
      })),
      experience: draft.experience.map((item) => ({
        company: (item.company || "").trim() || null,
        title: (item.title || "").trim() || null,
        start_date: (item.start_date || "").trim() || null,
        end_date: (item.end_date || "").trim() || null,
        description: (item.description || "").trim() || null,
      })),
    }
  }

  if (role === "recruiter") {
    return {
      ...base,
      phone: draft.phone.trim() || null,
      company_name: draft.companyName.trim() || null,
      job_title: draft.jobTitle.trim() || null,
    }
  }

  return base
}
