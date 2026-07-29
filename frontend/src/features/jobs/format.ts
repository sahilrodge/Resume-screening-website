import type { Job } from "@/types/job"
import { EMPLOYMENT_TYPE_LABELS } from "@/types/job"

export function formatJobSalary(job: Pick<Job, "salary_min" | "salary_max" | "currency">) {
  const { salary_min: min, salary_max: max, currency } = job
  if (min == null && max == null) return "Not specified"
  const code = (currency || "USD").toUpperCase()
  if (code === "INR") {
    const toLpa = (n: number) => (n / 100000).toFixed(1)
    if (min != null && max != null) return `₹${toLpa(min)}–${toLpa(max)} LPA`
    if (min != null) return `₹${toLpa(min)}+ LPA`
    return `Up to ₹${toLpa(max!)} LPA`
  }
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(n)
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`
  if (min != null) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

export function formatJobExperience(
  job: Pick<Job, "experience_min_years" | "experience_max_years">
) {
  const min = job.experience_min_years
  const max = job.experience_max_years
  if (min == null && max == null) return "Not specified"
  if (min != null && max != null) {
    if (min === max) return `${min} year${min === 1 ? "" : "s"}`
    return `${min}–${max} years`
  }
  if (min != null) return `${min}+ years`
  return `Up to ${max} years`
}

export function formatJobDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatEmploymentType(value?: string | null) {
  if (!value) return "—"
  return (
    EMPLOYMENT_TYPE_LABELS[value as keyof typeof EMPLOYMENT_TYPE_LABELS] ||
    value.replaceAll("_", " ")
  )
}

export function isJobDeadlinePassed(closesAt?: string | null) {
  if (!closesAt) return false
  const date = new Date(closesAt)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() < Date.now()
}
