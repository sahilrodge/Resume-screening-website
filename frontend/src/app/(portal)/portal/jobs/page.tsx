"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { applicationsApi } from "@/services/applications"
import { jobsApi } from "@/services/jobs"
import { resumesApi } from "@/services/resumes"
import type { ApplicationMatch } from "@/types/application"
import type { Job } from "@/types/job"
import { ApiError } from "@/types/api"
import { Button, buttonVariants } from "@/components/ui/button"

function PortalJobsContent() {
  const searchParams = useSearchParams()
  const query = (searchParams.get("q") ?? "").trim().toLowerCase()

  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<ApplicationMatch[]>([])
  const [hasResume, setHasResume] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const [openJobs, apps, resumes] = await Promise.all([
      jobsApi.listOpen({ page: 1, page_size: 100 }),
      applicationsApi.mine({ page: 1, page_size: 50 }),
      resumesApi.listMine({ page: 1, page_size: 1 }),
    ])
    setJobs(openJobs.items)
    setApplications(apps.items)
    setHasResume(resumes.total > 0 || resumes.items.length > 0)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .then(() => {
        if (!cancelled) setError(null)
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load jobs.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const appliedJobIds = useMemo(
    () => new Set(applications.map((a) => a.job_id)),
    [applications]
  )

  const filteredJobs = useMemo(() => {
    if (!query) return jobs
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(query) ||
        (job.company_name ?? "").toLowerCase().includes(query) ||
        (job.location ?? "").toLowerCase().includes(query)
    )
  }, [jobs, query])

  async function apply(jobId: string) {
    if (!hasResume) {
      setError("Upload a resume on your profile before applying.")
      return
    }
    setApplyingId(jobId)
    setError(null)
    setMessage(null)
    try {
      await applicationsApi.apply({ job_id: jobId })
      await load()
      setMessage("Application submitted.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply.")
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Open roles and the status of your applications.
        </p>
      </header>

      {!loading && !hasResume ? (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          Upload a resume before you can apply.{" "}
          <Link href="/portal/profile" className="font-medium text-primary underline">
            Go to profile
          </Link>
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your applications</h2>
        {applications.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : null}
        <ul className="divide-y divide-border">
          {applications.map((app) => (
            <li
              key={app.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{app.job_title ?? "Role"}</p>
                <p className="text-sm text-muted-foreground">
                  {app.company_name ?? "Company"}
                  {app.match_score != null
                    ? ` · Match ${Math.round(app.match_score)}%`
                    : ""}
                </p>
              </div>
              <span className="text-sm capitalize text-muted-foreground">
                {app.status.replaceAll("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Open roles</h2>
          {query ? (
            <Link
              href="/portal/jobs"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Clear search “{query}”
            </Link>
          ) : null}
        </div>
        {filteredJobs.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">
            {query ? "No jobs match your search." : "No open jobs right now."}
          </p>
        ) : null}
        <ul className="divide-y divide-border">
          {filteredJobs.map((job) => {
            const alreadyApplied = appliedJobIds.has(job.id)
            const applyDisabled =
              alreadyApplied || applyingId === job.id || !hasResume
            return (
              <li
                key={job.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  {job.company_logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.company_logo_url}
                      alt=""
                      className="mt-0.5 size-9 shrink-0 rounded-md border border-border bg-background object-contain p-1"
                    />
                  ) : null}
                  <div className="space-y-1">
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.company_name ?? "Company"}
                      {job.location ? ` · ${job.location}` : ""}
                      {job.employment_type
                        ? ` · ${job.employment_type.replaceAll("_", " ")}`
                        : ""}
                      {job.salary_min != null && job.currency === "INR"
                        ? ` · ₹${(job.salary_min / 100000).toFixed(1)}–${(
                            (job.salary_max ?? job.salary_min) / 100000
                          ).toFixed(1)} LPA`
                        : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={applyDisabled}
                  onClick={() => void apply(job.id)}
                >
                  {alreadyApplied
                    ? "Applied"
                    : !hasResume
                      ? "Resume required"
                      : applyingId === job.id
                        ? "Applying…"
                        : "Apply"}
                </Button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export default function PortalJobsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <PortalJobsContent />
    </Suspense>
  )
}
