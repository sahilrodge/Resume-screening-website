"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, RefreshCw, Sparkles } from "lucide-react"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MatchResultPanel } from "@/features/screening/match-result-panel"
import { useApiLoading } from "@/hooks/use-api-loading"
import { applicationsApi } from "@/services/applications"
import { jobsApi } from "@/services/jobs"
import { resumesApi } from "@/services/resumes"
import { ApiError } from "@/types/api"
import type { ApplicationMatch } from "@/types/application"
import { APPLICATION_STATUS_LABELS } from "@/types/application"
import type { Job } from "@/types/job"
import type { Resume } from "@/types/resume"

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

  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === resumeId) ?? null,
    [resumes, resumeId]
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const [jobData, resumeData, appData] = await Promise.all([
        jobsApi.list({ page: 1, page_size: 100, sort_by: "created_at", sort_order: "desc" }),
        resumesApi.list({ page: 1, page_size: 100 }),
        applicationsApi.list({
          page: 1,
          page_size: 20,
          sort_by: "match_score",
          sort_order: "desc",
        }),
      ])
      setJobs(jobData.items)
      setResumes(resumeData.items)
      setHistory(appData.items)
      setJobId((prev) => prev || preselectedJobId || jobData.items[0]?.id || "")
      setResumeId((prev) => prev || resumeData.items[0]?.id || "")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load screening data")
    }
  }, [preselectedJobId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCompare() {
    if (!jobId || !resumeId) {
      setError("Select both a job and a resume")
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
        page_size: 20,
        sort_by: "match_score",
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
          title="AI Screening"
          description="Compare a parsed resume with a job description. Score, skills, summary, and reasoning are stored."
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
            <h2 className="font-heading text-base font-semibold">Run comparison</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="job">Job description</Label>
              <select
                id="job"
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">Select job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                    {job.company_name ? ` · ${job.company_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="resume">Resume</Label>
              <select
                id="resume"
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
              >
                <option value="">Select resume</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.candidate_name || "Candidate"} · {resume.file_name} (
                    {resume.status})
                  </option>
                ))}
              </select>
              {selectedResume && selectedResume.status !== "parsed" ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This resume is not fully parsed yet — matching works best when status is
                  “parsed”.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <Button onClick={() => void handleCompare()} disabled={comparing || loading}>
              <Sparkles data-icon="inline-start" />
              {comparing ? "Comparing with OpenAI…" : "Compare resume & job"}
            </Button>
          </div>
        </div>
      </FadeIn>

      {result ? (
        <FadeIn>
          <MatchResultPanel result={result} />
        </FadeIn>
      ) : null}

      <FadeIn>
        <AdminTableShell
          title="Stored match results"
          description="Previous OpenAI comparisons saved on applications."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead className="hidden md:table-cell">Job</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No matches stored yet — run a comparison above"}
                  </TableCell>
                </TableRow>
              ) : (
                history.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">{row.candidate_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.candidate_email || row.resume_file_name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div>{row.job_title || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.company_name || ""}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {row.match_score != null ? `${Math.round(row.match_score)}%` : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={APPLICATION_STATUS_LABELS[row.status]} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/screening/${row.id}`}
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                        aria-label="View match"
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
