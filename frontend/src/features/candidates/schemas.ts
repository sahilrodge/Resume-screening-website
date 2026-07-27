import { z } from "zod"

export const candidateCreateSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(255),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  phone: z.string().optional(),
  location: z.string().optional(),
  current_title: z.string().optional(),
  headline: z.string().optional(),
  years_experience: z.string().optional(),
  linkedin_url: z.string().optional(),
  portfolio_url: z.string().optional(),
  summary: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.years_experience?.trim()) {
    const n = Number(data.years_experience)
    if (!Number.isInteger(n) || n < 0 || n > 80) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["years_experience"],
        message: "Experience must be 0–80",
      })
    }
  }
  for (const key of ["linkedin_url", "portfolio_url"] as const) {
    const value = data[key]?.trim()
    if (value) {
      try {
        new URL(value)
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Enter a valid URL",
        })
      }
    }
  }
})

export const candidateUpdateSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(255),
  phone: z.string().optional(),
  location: z.string().optional(),
  current_title: z.string().optional(),
  headline: z.string().optional(),
  years_experience: z.string().optional(),
  linkedin_url: z.string().optional(),
  portfolio_url: z.string().optional(),
  summary: z.string().optional(),
  is_active: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.years_experience?.trim()) {
    const n = Number(data.years_experience)
    if (!Number.isInteger(n) || n < 0 || n > 80) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["years_experience"],
        message: "Experience must be 0–80",
      })
    }
  }
  for (const key of ["linkedin_url", "portfolio_url"] as const) {
    const value = data[key]?.trim()
    if (value) {
      try {
        new URL(value)
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Enter a valid URL",
        })
      }
    }
  }
})

export type CandidateCreateValues = z.infer<typeof candidateCreateSchema>
export type CandidateUpdateValues = z.infer<typeof candidateUpdateSchema>

export function toCreatePayload(values: CandidateCreateValues) {
  const years = values.years_experience?.trim()
  return {
    full_name: values.full_name.trim(),
    email: values.email.trim(),
    password: values.password,
    phone: values.phone?.trim() || undefined,
    location: values.location?.trim() || undefined,
    current_title: values.current_title?.trim() || undefined,
    headline: values.headline?.trim() || undefined,
    summary: values.summary?.trim() || undefined,
    linkedin_url: values.linkedin_url?.trim() || undefined,
    portfolio_url: values.portfolio_url?.trim() || undefined,
    years_experience: years ? Number(years) : undefined,
  }
}

export function toUpdatePayload(values: CandidateUpdateValues) {
  const years = values.years_experience?.trim()
  return {
    full_name: values.full_name.trim(),
    phone: values.phone?.trim() || null,
    location: values.location?.trim() || null,
    current_title: values.current_title?.trim() || null,
    headline: values.headline?.trim() || null,
    summary: values.summary?.trim() || null,
    linkedin_url: values.linkedin_url?.trim() || null,
    portfolio_url: values.portfolio_url?.trim() || null,
    years_experience: years ? Number(years) : null,
    is_active: values.is_active,
  }
}
