import { z } from "zod"

const employmentTypes = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "remote",
] as const

const jobStatuses = ["draft", "open", "closed", "filled"] as const

export const jobCreateSchema = z
  .object({
    company_id: z.string().min(1, "Company is required"),
    title: z.string().trim().min(1, "Title is required").max(255),
    description: z.string().trim().min(1, "Description is required"),
    location: z.string().optional(),
    employment_type: z.enum(employmentTypes),
    status: z.enum(jobStatuses),
    salary_min: z.string().optional(),
    salary_max: z.string().optional(),
    currency: z.string().trim().min(1).max(10),
    experience_min_years: z.string().optional(),
    experience_max_years: z.string().optional(),
    openings: z.string().optional(),
    closes_at: z.string().optional(),
    skills: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const salaryMin = data.salary_min?.trim()
    const salaryMax = data.salary_max?.trim()
    if (salaryMin && Number.isNaN(Number(salaryMin))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salary_min"],
        message: "Enter a valid number",
      })
    }
    if (salaryMax && Number.isNaN(Number(salaryMax))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salary_max"],
        message: "Enter a valid number",
      })
    }
    if (
      salaryMin &&
      salaryMax &&
      !Number.isNaN(Number(salaryMin)) &&
      !Number.isNaN(Number(salaryMax)) &&
      Number(salaryMin) > Number(salaryMax)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salary_max"],
        message: "Max salary must be ≥ min",
      })
    }

    for (const key of ["experience_min_years", "experience_max_years"] as const) {
      const value = data[key]?.trim()
      if (!value) continue
      const n = Number(value)
      if (!Number.isInteger(n) || n < 0 || n > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Must be 0–80",
        })
      }
    }

    const expMin = data.experience_min_years?.trim()
    const expMax = data.experience_max_years?.trim()
    if (
      expMin &&
      expMax &&
      Number(expMin) > Number(expMax)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["experience_max_years"],
        message: "Max experience must be ≥ min",
      })
    }

    if (data.openings?.trim()) {
      const n = Number(data.openings)
      if (!Number.isInteger(n) || n < 1 || n > 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["openings"],
          message: "Openings must be 1–1000",
        })
      }
    }
  })

export const jobUpdateSchema = jobCreateSchema

export type JobCreateValues = z.infer<typeof jobCreateSchema>
export type JobUpdateValues = z.infer<typeof jobUpdateSchema>

function optionalNumber(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return Number(trimmed)
}

function parseSkills(value?: string) {
  if (!value?.trim()) return []
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function toClosesAtIso(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const date = new Date(`${trimmed}T23:59:59`)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export function toCreatePayload(values: JobCreateValues) {
  return {
    company_id: values.company_id,
    title: values.title.trim(),
    description: values.description.trim(),
    location: values.location?.trim() || undefined,
    employment_type: values.employment_type,
    status: values.status,
    salary_min: optionalNumber(values.salary_min),
    salary_max: optionalNumber(values.salary_max),
    currency: values.currency.trim() || "USD",
    experience_min_years: optionalNumber(values.experience_min_years),
    experience_max_years: optionalNumber(values.experience_max_years),
    openings: optionalNumber(values.openings) ?? 1,
    closes_at: toClosesAtIso(values.closes_at),
    skills: parseSkills(values.skills),
  }
}

export function toUpdatePayload(values: JobUpdateValues) {
  return {
    company_id: values.company_id,
    title: values.title.trim(),
    description: values.description.trim(),
    location: values.location?.trim() || null,
    employment_type: values.employment_type,
    status: values.status,
    salary_min: optionalNumber(values.salary_min) ?? null,
    salary_max: optionalNumber(values.salary_max) ?? null,
    currency: values.currency.trim() || "USD",
    experience_min_years: optionalNumber(values.experience_min_years) ?? null,
    experience_max_years: optionalNumber(values.experience_max_years) ?? null,
    openings: optionalNumber(values.openings) ?? 1,
    closes_at: toClosesAtIso(values.closes_at) ?? null,
    skills: parseSkills(values.skills),
  }
}
