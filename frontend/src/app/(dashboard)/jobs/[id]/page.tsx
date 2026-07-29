"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  MapPin,
  Pencil,
  ScanSearch,
  Users,
} from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { HirePulseMark } from "@/components/brand/hirepulse-mark"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { JobFormDialog } from "@/features/jobs/job-form-dialog"
import {
  toUpdatePayload,
  type JobUpdateValues,
} from "@/features/jobs/schemas"
import { useApiLoading } from "@/hooks/use-api-loading"
import { jobsApi } from "@/services/jobs"
import { applicationsApi } from "@/services/applications"
import { ApiError } from "@/types/api"
import type { ApplicationMatch } from "@/types/application"
import { APPLICATION_STATUS_LABELS } from "@/types/application"
import type { Job } from "@/types/job"
import { EMPLOYMENT_TYPE_LABELS, JOB_STATUS_LABELS } from "@/types/job"

export default function JobDetailsPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const apiLoading = useApiLoading()
  const [job, setJob] = useState<Job | null>(null)
  const [matches, setMatches] = useState<ApplicationMatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [data, apps] = await Promise.all([
        jobsApi.get(id),
        applicationsApi.list({
          job_id: id,
          page: 1,
          page_size: 20,
          sort_by: "match_score",
          sort_order: "desc",
        }),
      ])
      setJob(data)
      setMatches(apps.items)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load job")
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleUpdate(values: JobUpdateValues) {
    if (!job) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await jobsApi.update(job.id, toUpdatePayload(values))
      setJob(updated)
      setDialogOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setSubmitting(false)
    }
  }

  function formatSalary(j: Job) {
    if (j.salary_min == null && j.salary_max == null) return "Not specified"
    if (j.currency === "INR") {
      const toLpa = (n: number) => (n / 100_000).toFixed(1)
      const min = j.salary_min != null ? `${toLpa(j.salary_min)}` : "—"
      const max = j.salary_max != null ? `${toLpa(j.salary_max)}` : "—"
      return `₹${min}–${max} LPA`
    }
    const min =
      j.salary_min != null ? `${j.currency} ${j.salary_min.toLocaleString()}` : "—"
    const max =
      j.salary_max != null ? `${j.currency} ${j.salary_max.toLocaleString()}` : "—"
    return `${min} – ${max}`
  }

  function formatExperience(j: Job) {
    if (j.experience_min_years == null && j.experience_max_years == null) {
      return "Not specified"
    }
    if (j.experience_min_years != null && j.experience_max_years != null) {
      return `${j.experience_min_years}–${j.experience_max_years} years`
    }
    if (j.experience_min_years != null) return `${j.experience_min_years}+ years`
    return `Up to ${j.experience_max_years} years`
  }

  return (
    <PageTransition>
      <PageHeader
        title={job?.title ?? "Job details"}
        description={
          job
            ? `${job.company_name || "Company"} · ${JOB_STATUS_LABELS[job.status]}`
            : "Role overview, applications, and status"
        }
        actions={
          <div className="flex gap-2">
            <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="size-4" />
              Back
            </Link>
            {job ? (
              <Link
                href={`/screening?job_id=${job.id}`}
                className={buttonVariants({ variant: "outline" })}
              >
                <ScanSearch className="size-4" />
                Screen resume
              </Link>
            ) : null}
            {job ? (
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!job && apiLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {job ? (
        <div className="space-y-8">
          <FadeIn>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <StatusBadge status={JOB_STATUS_LABELS[job.status]} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Users className="size-3.5" />
                  Applications
                </div>
                <p className="font-heading text-2xl font-semibold tabular-nums">
                  {job.application_count}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Briefcase className="size-3.5" />
                  Openings
                </div>
                <p className="font-heading text-2xl font-semibold tabular-nums">{job.openings}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                <Badge variant="outline">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</Badge>
              </div>
            </div>
          </FadeIn>

          <Separator />

          <FadeIn>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-4 text-muted-foreground" />
                <div className="flex items-center gap-3">
                  <Link href={`/companies/${job.company_id}`} className="shrink-0">
                    <HirePulseMark size="md" />
                  </Link>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Company
                    </p>
                    <p className="font-medium">
                      <Link
                        href={`/companies/${job.company_id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {job.company_name || "—"}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Location</p>
                  <p className="font-medium">{job.location || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Salary</p>
                <p className="font-medium">{formatSalary(job)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Experience</p>
                <p className="font-medium">{formatExperience(job)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Apply deadline
                </p>
                <p className="font-medium">
                  {job.closes_at
                    ? new Date(job.closes_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "Open-ended"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Published</p>
                <p className="font-medium">
                  {job.published_at
                    ? new Date(job.published_at).toLocaleString()
                    : "Not published"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recruiter</p>
                <p className="font-medium">{job.recruiter_name || "Unassigned"}</p>
              </div>
            </section>
          </FadeIn>

          {job.skills && job.skills.length > 0 ? (
            <FadeIn>
              <section className="space-y-2">
                <h2 className="font-heading text-lg font-semibold">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </section>
            </FadeIn>
          ) : null}

          <FadeIn>
            <section className="space-y-2">
              <h2 className="font-heading text-lg font-semibold">Description</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {(job.description ?? "")
                  .replace(/\s*<!-- seed:indian_jobs_v1 -->\s*/g, "")
                  .trim() || "No description provided."}
              </p>
            </section>
          </FadeIn>

          <FadeIn>
            <section className="space-y-3">
              <h2 className="font-heading text-lg font-semibold">Screened applicants</h2>
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matches yet. Use Screen resume to compare a candidate.
                </p>
              ) : (
                <ul className="divide-y divide-border/70 rounded-xl border border-border/60">
                  {matches.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{m.candidate_name || "Candidate"}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.summary
                            ? `${m.summary.slice(0, 90)}${m.summary.length > 90 ? "…" : ""}`
                            : APPLICATION_STATUS_LABELS[m.status]}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-heading text-lg font-semibold tabular-nums">
                          {m.match_score != null ? `${Math.round(m.match_score)}%` : "—"}
                        </span>
                        <Link
                          href={`/screening/${m.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          View
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </FadeIn>
        </div>
      ) : null}

      <JobFormDialog
        open={dialogOpen}
        mode="edit"
        job={job}
        submitting={submitting}
        onOpenChange={setDialogOpen}
        onUpdate={handleUpdate}
      />
    </PageTransition>
  )
}
