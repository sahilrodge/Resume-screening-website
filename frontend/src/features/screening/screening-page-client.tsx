"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, RefreshCw, Sparkles } from "lucide-react"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MatchResultPanel } from "@/features/screening/match-result-panel"
import { CandidateDecisionActions } from "@/features/screening/candidate-decision-actions"
import { StatusBadge } from "@/components/admin/status-badge"
import { useApiLoading } from "@/hooks/use-api-loading"
import { applicationsApi } from "@/services/applications"
import { jobsApi } from "@/services/jobs"
import { resumesApi } from "@/services/resumes"
import { ApiError } from "@/types/api"
import type { ApplicationMatch } from "@/types/application"
import { APPLICATION_STATUS_LABELS } from "@/types/application"
import type { Job } from "@/types/job"
import type { Resume } from "@/types/resume"

function formatJobLabel(job: Pick<Job, "title" | "company_name">) {
  const company = (job.company_name || "").trim()
  const title = (job.title || "").trim() || "Untitled role"
  return company ? `${company} - ${title}` : title
}

function formatJobLabelFromMatch(row: ApplicationMatch) {
  return formatJobLabel({
    title: row.job_title || "Untitled role",
    company_name: row.company_name,
  })
}

function candidateName(resume: Resume) {
  const name = (resume.candidate_name || "").trim()
  if (name && name.toLowerCase() !== "unknown candidate") return name
  if (resume.candidate_email) return resume.candidate_email
  return "Unknown candidate"
}

function chipList(items: string[] | null | undefined, empty = "—", limit = 3) {
  const list = (items ?? []).filter(Boolean)
  if (!list.length) {
    return <span className="text-sm text-muted-foreground">{empty}</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {list.slice(0, limit).map((item) => (
        <Badge
          key={item}
          variant="outline"
          className="max-w-40 truncate font-normal"
          title={item}
        >
          {item}
        </Badge>
      ))}
      {list.length > limit ? (
        <span className="text-xs text-muted-foreground">+{list.length - limit}</span>
      ) : null}
    </div>
  )
}

function formatScore(score: number | null | undefined) {
  if (score == null || Number.isNaN(Number(score))) return "—"
  return `${Math.round(Number(score))}%`
}

/** One selectable resume per candidate — prefer latest/primary. */
function uniqueCandidateResumes(resumes: Resume[]) {
  const ordered = [...resumes].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  const seen = new Set<string>()
  const unique: Resume[] = []
  for (const resume of ordered) {
    if (seen.has(resume.candidate_id)) continue
    seen.add(resume.candidate_id)
    unique.push(resume)
  }
  return unique.sort((a, b) =>
    candidateName(a).localeCompare(candidateName(b), undefined, {
      sensitivity: "base",
    })
  )
}

export default function ScreeningPageClient() {
  const searchParams = useSearchParams()
  const preselectedJobId = searchParams.get("job_id") || ""
  const { loading } = useApiLoading()
  const [jobs, setJobs] = useState<Job[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  const [history, setHistory] = useState<ApplicationMatch[]>([])
  const [jobId, setJobId] = useState(preselectedJobId)
  const [resumeId, setResumeId] = useState("")
  const [result, setResult] = useState<ApplicationMatch | null>(null)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidateResumes = useMemo(
    () => uniqueCandidateResumes(resumes),
    [resumes]
  )

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId]
  )
  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === resumeId) ?? null,
    [resumes, resumeId]
  )

  const jobSelectItems = useMemo(
    () => [
      { value: "__none__", label: "Select job" },
      ...jobs.map((job) => ({
        value: job.id,
        label: formatJobLabel(job),
      })),
    ],
    [jobs]
  )

  const resumeSelectItems = useMemo(
    () => [
      { value: "__none__", label: "Select candidate" },
      ...candidateResumes.map((resume) => ({
        value: resume.id,
        label: candidateName(resume),
      })),
    ],
    [candidateResumes]
  )

  const screenedHistory = useMemo(
    () =>
      [...history]
        .filter(
          (row) =>
            row.match_score != null ||
            row.ats_score != null ||
            Boolean(row.summary) ||
            (row.missing_skills?.length ?? 0) > 0 ||
            (row.strengths?.length ?? 0) > 0
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
        ),
    [history]
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const [jobData, resumeData, appData] = await Promise.all([
        jobsApi.list({
          page: 1,
          page_size: 100,
          sort_by: "created_at",
          sort_order: "desc",
        }),
        resumesApi.list({ page: 1, page_size: 100 }),
        applicationsApi.list({
          page: 1,
          page_size: 50,
          sort_by: "created_at",
          sort_order: "desc",
        }),
      ])
      const orderedJobs = [...jobData.items].sort((a, b) =>
        formatJobLabel(a).localeCompare(formatJobLabel(b), undefined, {
          sensitivity: "base",
        })
      )
      setJobs(orderedJobs)
      setResumes(resumeData.items)
      setHistory(appData.items)

      const unique = uniqueCandidateResumes(resumeData.items)
      setJobId((prev) => prev || preselectedJobId || orderedJobs[0]?.id || "")
      setResumeId((prev) => {
        if (prev && unique.some((r) => r.id === prev)) return prev
        if (prev) {
          const sameCandidate = unique.find(
            (r) =>
              resumeData.items.find((x) => x.id === prev)?.candidate_id ===
              r.candidate_id
          )
          if (sameCandidate) return sameCandidate.id
        }
        return unique[0]?.id || ""
      })
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load screening data"
      )
    }
  }, [preselectedJobId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCompare() {
    if (!jobId || !resumeId) {
      setError("Select both a job and a candidate resume")
      return
    }
    setComparing(true)
    setError(null)
    try {
      const match = await applicationsApi.compare({
        job_id: jobId,
        resume_id: resumeId,
      })
      setResult(match)
      const appData = await applicationsApi.list({
        page: 1,
        page_size: 50,
        sort_by: "created_at",
        sort_order: "desc",
      })
      setHistory(appData.items)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Comparison failed")
    } finally {
      setComparing(false)
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="AI Resume Screening"
          description="Compare a candidate resume with a job. ATS score, missing skills, strengths, and suggestions are saved in screening history."
          actions={
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
          }
        />
      </FadeIn>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <FadeIn>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-none md:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold">
              Run screening
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="job">Job</Label>
              <Select
                value={jobId || "__none__"}
                onValueChange={(value) =>
                  setJobId(!value || value === "__none__" ? "" : value)
                }
                items={jobSelectItems}
              >
                <SelectTrigger id="job" className="w-full">
                  <SelectValue placeholder="Select job">
                    {(value) => {
                      if (!value || value === "__none__") return null
                      const job = jobs.find((j) => j.id === value)
                      return job ? formatJobLabel(job) : null
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" label="Select job">
                    Select job
                  </SelectItem>
                  {jobs.map((job) => {
                    const label = formatJobLabel(job)
                    return (
                      <SelectItem key={job.id} value={job.id} label={label}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedJob ? (
                <p className="text-xs text-muted-foreground">
                  Selected:{" "}
                  <span className="font-medium">
                    {formatJobLabel(selectedJob)}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="resume">Candidate</Label>
              <Select
                value={resumeId || "__none__"}
                onValueChange={(value) =>
                  setResumeId(!value || value === "__none__" ? "" : value)
                }
                items={resumeSelectItems}
              >
                <SelectTrigger id="resume" className="w-full">
                  <SelectValue placeholder="Select candidate">
                    {(value) => {
                      if (!value || value === "__none__") return null
                      const resume =
                        candidateResumes.find((r) => r.id === value) ||
                        resumes.find((r) => r.id === value)
                      return resume ? candidateName(resume) : null
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" label="Select candidate">
                    Select candidate
                  </SelectItem>
                  {candidateResumes.map((resume) => {
                    const label = candidateName(resume)
                    return (
                      <SelectItem key={resume.id} value={resume.id} label={label}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedResume ? (
                <p className="text-xs text-muted-foreground">
                  Screening{" "}
                  <span className="font-medium">
                    {candidateName(selectedResume)}
                  </span>
                  {selectedResume.candidate_email
                    ? ` · ${selectedResume.candidate_email}`
                    : ""}
                </p>
              ) : null}
              {selectedResume && selectedResume.status !== "parsed" ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Resume status is “{selectedResume.status}”. Compare will try to
                  re-parse when possible.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <Button
              onClick={() => void handleCompare()}
              disabled={comparing || !jobId || !resumeId}
            >
              <Sparkles data-icon="inline-start" />
              {comparing ? "Screening…" : "Run AI screening"}
            </Button>
          </div>
        </div>
      </FadeIn>

      {result ? (
        <FadeIn>
          <div className="space-y-4">
            <MatchResultPanel result={result} />
            <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-5">
              <div>
                <h2 className="font-heading text-base font-semibold">
                  Candidate decision
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select or reject this candidate. Confirmation is required before
                  the application status is updated.
                </p>
              </div>
              <CandidateDecisionActions
                application={result}
                onUpdated={(updated) => {
                  setResult(updated)
                  setHistory((current) =>
                    current.map((row) => (row.id === updated.id ? updated : row))
                  )
                }}
              />
            </section>
          </div>
        </FadeIn>
      ) : null}

      <FadeIn>
        <AdminTableShell
          title="Screening history"
          description="Saved ATS scores, missing skills, suggestions, and candidate strengths"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead className="hidden lg:table-cell">Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ATS Score</TableHead>
                <TableHead className="hidden md:table-cell">
                  Missing Skills
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  Suggestions
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  Candidate Strengths
                </TableHead>
                <TableHead className="text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {screenedHistory.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {loading
                      ? "Loading…"
                      : "No screening history yet — run a comparison above"}
                  </TableCell>
                </TableRow>
              ) : (
                screenedHistory.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">
                        {row.candidate_name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground lg:hidden">
                        {formatJobLabelFromMatch(row)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-56 lg:table-cell">
                      <div className="truncate font-medium" title={formatJobLabelFromMatch(row)}>
                        {formatJobLabelFromMatch(row)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={
                          row.status === "selected" ||
                          row.status === "hired" ||
                          row.status === "offered"
                            ? "Selected"
                            : row.status === "rejected"
                              ? "Rejected"
                              : APPLICATION_STATUS_LABELS[row.status]
                        }
                      />
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatScore(row.ats_score ?? row.match_score)}
                    </TableCell>
                    <TableCell className="hidden max-w-52 md:table-cell">
                      {chipList(row.missing_skills, "None")}
                    </TableCell>
                    <TableCell className="hidden max-w-56 xl:table-cell">
                      {chipList(row.suggestions, "None", 2)}
                    </TableCell>
                    <TableCell className="hidden max-w-56 xl:table-cell">
                      {chipList(row.strengths, "None", 2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/screening/${row.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon-sm",
                        })}
                        aria-label={`View screening for ${row.candidate_name || "candidate"}`}
                      >
                        <Eye />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AdminTableShell>
      </FadeIn>
    </PageTransition>
  )
}
