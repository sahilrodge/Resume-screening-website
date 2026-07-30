"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bookmark, BookmarkX, Search } from "lucide-react"

import { applicationsApi } from "@/services/applications"
import { jobsApi } from "@/services/jobs"
import type { EmploymentType, Job } from "@/types/job"
import { EMPLOYMENT_TYPE_LABELS } from "@/types/job"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
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

type TypeFilter = "all" | EmploymentType
type AppliedFilter = "all" | "saved_only" | "applied"

export default function SavedJobsPage() {
  const {
    savedJobs,
    applications,
    hasResume,
    loading,
    error: syncError,
    markJobSaved,
    refresh,
  } = useCandidateSync()

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter>("all")
  const [error, setError] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmJob, setConfirmJob] = useState<Job | null>(null)

  const appliedJobIds = useMemo(
    () => new Set(applications.map((a) => a.job_id)),
    [applications]
  )

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return savedJobs.filter((job) => {
      if (typeFilter !== "all" && job.employment_type !== typeFilter) {
        return false
      }
      const applied = appliedJobIds.has(job.id)
      if (appliedFilter === "applied" && !applied) return false
      if (appliedFilter === "saved_only" && applied) return false
      if (!q) return true
      return (
        job.title.toLowerCase().includes(q) ||
        (job.company_name ?? "").toLowerCase().includes(q) ||
        (job.location ?? "").toLowerCase().includes(q) ||
        (job.description ?? "").toLowerCase().includes(q) ||
        (job.skills ?? []).some((skill) => skill.toLowerCase().includes(q))
      )
    })
  }, [savedJobs, search, typeFilter, appliedFilter, appliedJobIds])

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

  async function removeSaved(job: Job) {
    setRemovingId(job.id)
    setError(null)
    try {
      await jobsApi.unsave(job.id)
      markJobSaved(job.id, false)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not remove saved job."
      )
    } finally {
      setRemovingId(null)
    }
  }

  const displayError = error || syncError

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Saved Jobs"
        description="Roles you bookmarked — remove, search, filter, or apply when ready."
      />

      {!loading && !hasResume ? (
        <InlineAlert variant="info">
          Upload a resume before you can apply.{" "}
          <Link
            href="/portal/profile"
            className="font-medium underline"
          >
            Go to profile
          </Link>
        </InlineAlert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved jobs…"
            className="h-9 bg-muted/40 pl-8"
            aria-label="Search saved jobs"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) =>
            setTypeFilter((value ?? "all") as TypeFilter)
          }
        >
          <SelectTrigger className="w-full sm:w-[10.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(
              Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]
            ).map((type) => (
              <SelectItem key={type} value={type}>
                {EMPLOYMENT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={appliedFilter}
          onValueChange={(value) =>
            setAppliedFilter((value ?? "all") as AppliedFilter)
          }
        >
          <SelectTrigger className="w-full sm:w-[11rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All saved</SelectItem>
            <SelectItem value="saved_only">Not applied</SelectItem>
            <SelectItem value="applied">Already applied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <PageSkeleton withHeader={false} rows={4} /> : null}
      {displayError ? (
        <InlineAlert variant="error">{displayError}</InlineAlert>
      ) : null}

      {!loading ? (
        <p className="text-sm text-muted-foreground">
          {filteredJobs.length} of {savedJobs.length} saved{" "}
          {savedJobs.length === 1 ? "job" : "jobs"}
          {search.trim() || typeFilter !== "all" || appliedFilter !== "all"
            ? " matching filters"
            : ""}
        </p>
      ) : null}

      <section className="space-y-3">
        {filteredJobs.length === 0 && !loading ? (
          <EmptyState
            icon={Bookmark}
            title={
              savedJobs.length === 0
                ? "No saved jobs yet"
                : "No matching saved jobs"
            }
            description={
              savedJobs.length === 0
                ? "Browse open roles and tap Save to bookmark them here."
                : "Try a different search or clear your filters."
            }
            action={
              savedJobs.length === 0 ? (
                <Link
                  href="/portal/jobs"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Browse jobs
                </Link>
              ) : null
            }
          />
        ) : null}

        <ul className="divide-y divide-border">
          {filteredJobs.map((job) => {
            const alreadyApplied = appliedJobIds.has(job.id)
            const deadlinePassed = isJobDeadlinePassed(job.closes_at)
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
                      disabled={removingId === job.id}
                      onClick={() => void removeSaved(job)}
                      className="gap-1.5"
                    >
                      <BookmarkX className="size-4" />
                      {removingId === job.id ? "Removing…" : "Remove"}
                    </Button>
                    <Link
                      href={`/portal/jobs/${job.id}`}
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
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
              Your application for {confirmJob?.title ?? "this role"} was stored
              and sent to the recruiter. You can track it under Jobs → Your
              applications.
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
