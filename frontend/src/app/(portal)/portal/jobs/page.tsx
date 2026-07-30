"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Bookmark, BookmarkCheck, Briefcase } from "lucide-react"

import { applicationsApi } from "@/services/applications"
import { jobsApi } from "@/services/jobs"
import type { Job } from "@/types/job"
import { ApiError } from "@/types/api"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { ApplicationStatusBadge } from "@/components/shared/application-status-badge"
import { useCandidateSync } from "@/features/candidate/candidate-sync-provider"
import {
  formatEmploymentType,
  formatJobDate,
  formatJobExperience,
  formatJobSalary,
  isJobDeadlinePassed,
} from "@/features/jobs/format"
import { CompanyLink } from "@/features/companies/company-link"
import { HirePulseMark } from "@/components/brand/hirepulse-mark"

function PortalJobsContent() {
  const searchParams = useSearchParams()
  const query = (searchParams.get("q") ?? "").trim().toLowerCase()
  const {
    applications,
    hasResume,
    savedJobIds,
    markJobSaved,
    refresh,
    error: syncError,
  } = useCandidateSync()

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmJob, setConfirmJob] = useState<Job | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    jobsApi
      .listOpen({
        page: 1,
        page_size: 100,
        search: query || undefined,
      })
      .then((openJobs) => {
        if (!cancelled) {
          setJobs(openJobs.items)
          setError(null)
        }
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
  }, [query])

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
        (job.location ?? "").toLowerCase().includes(query) ||
        (job.description ?? "").toLowerCase().includes(query) ||
        (job.skills ?? []).some((skill) => skill.toLowerCase().includes(query))
    )
  }, [jobs, query])

  async function apply(job: Job) {
    if (!hasResume) {
      setError("Upload a resume on your profile before applying.")
      return
    }
    if (isJobDeadlinePassed(job.closes_at)) {
      setError("The application deadline for this job has passed.")
      return
    }
    setApplyingId(job.id)
    setError(null)
    try {
      await applicationsApi.apply({ job_id: job.id })
      await refresh({ silent: true })
      setConfirmJob(job)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply.")
    } finally {
      setApplyingId(null)
    }
  }

  async function toggleSave(job: Job) {
    setSavingId(job.id)
    setError(null)
    const wasSaved = savedJobIds.has(job.id)
    try {
      if (wasSaved) {
        await jobsApi.unsave(job.id)
        markJobSaved(job.id, false)
      } else {
        await jobsApi.save(job.id)
        markJobSaved(job.id, true)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update saved job.")
    } finally {
      setSavingId(null)
    }
  }

  const displayError = error || syncError

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Jobs"
        description="Browse open roles, save jobs, and track your applications."
      />

      {!loading && !hasResume ? (
        <InlineAlert variant="info">
          Upload a resume before you can apply.{" "}
          <Link href="/portal/profile" className="font-medium underline">
            Go to profile
          </Link>
        </InlineAlert>
      ) : null}

      {loading ? <PageSkeleton withHeader={false} rows={4} /> : null}
      {displayError ? (
        <InlineAlert variant="error">{displayError}</InlineAlert>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your applications</h2>
        {applications.length === 0 && !loading ? (
          <EmptyState
            icon={Briefcase}
            title="No applications yet"
            description="Apply to an open role below to track status and match scores here."
          />
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
              <ApplicationStatusBadge status={app.status} />
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
          <EmptyState
            icon={Briefcase}
            title={query ? "No matching jobs" : "No open jobs"}
            description={
              query
                ? "Try a different search, or clear filters to see all open roles."
                : "Check back soon — new roles will show up here when published."
            }
          />
        ) : null}
        <ul className="divide-y divide-border">
          {filteredJobs.map((job) => {
            const alreadyApplied = appliedJobIds.has(job.id)
            const deadlinePassed = isJobDeadlinePassed(job.closes_at)
            const isSaved = savedJobIds.has(job.id)
            const applyDisabled =
              alreadyApplied ||
              applyingId === job.id ||
              !hasResume ||
              deadlinePassed
            return (
              <li key={job.id} className="space-y-3 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <CompanyLink
                      companyId={job.company_id}
                      hrefBase="/portal/companies"
                      className="shrink-0"
                    >
                      <span className="mt-0.5 inline-flex">
                        <HirePulseMark size="sm" />
                      </span>
                    </CompanyLink>
                    <div className="space-y-1.5">
                      <Link
                        href={`/portal/jobs/${job.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {job.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        <CompanyLink
                          companyId={job.company_id}
                          name={job.company_name}
                          hrefBase="/portal/companies"
                          className="font-medium text-foreground"
                        />
                        {job.location ? ` · ${job.location}` : ""}
                        {` · ${formatEmploymentType(job.employment_type)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatJobSalary(job)}
                        {" · "}
                        Exp {formatJobExperience(job)}
                        {" · "}
                        Posted {formatJobDate(job.published_at || job.created_at)}
                        {" · "}
                        Deadline {formatJobDate(job.closes_at)}
                      </p>
                      {job.skills && job.skills.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Skills: {job.skills.slice(0, 6).join(", ")}
                          {job.skills.length > 6 ? "…" : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingId === job.id}
                      onClick={() => void toggleSave(job)}
                      className="gap-1.5"
                    >
                      {isSaved ? (
                        <BookmarkCheck className="size-4" />
                      ) : (
                        <Bookmark className="size-4" />
                      )}
                      {isSaved ? "Saved" : "Save"}
                    </Button>
                    <Link
                      href={`/portal/jobs/${job.id}`}
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                    >
                      Details
                    </Link>
                    <Button
                      size="sm"
                      disabled={applyDisabled}
                      onClick={() => void apply(job)}
                    >
                      {alreadyApplied
                        ? "Applied"
                        : deadlinePassed
                          ? "Closed"
                          : !hasResume
                            ? "Resume required"
                            : applyingId === job.id
                              ? "Applying…"
                              : "Apply"}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <Dialog
        open={Boolean(confirmJob)}
        onOpenChange={(open) => {
          if (!open) setConfirmJob(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Application submitted</DialogTitle>
            <DialogDescription>
              Your application for {confirmJob?.title ?? "this role"} was stored and
              sent to the recruiter. You can track it under Your applications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setConfirmJob(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PortalJobsPage() {
  return (
    <Suspense fallback={<PageSkeleton withHeader={false} rows={4} />}>
      <PortalJobsContent />
    </Suspense>
  )
}
