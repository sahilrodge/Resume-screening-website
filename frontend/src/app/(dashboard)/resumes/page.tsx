"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Download,
  Eye,
  FileText,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { DataToolbar } from "@/components/admin/data-toolbar"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
import {
  formatBytes,
  RESUME_ACCEPT,
  RESUME_FORMAT_LABEL,
  RESUME_MAX_SIZE_MB,
  validateResumeFile,
} from "@/features/resumes/resume-upload"
import { candidatesApi } from "@/services/candidates"
import { resumesApi } from "@/services/resumes"
import { ApiError } from "@/types/api"
import type { Candidate } from "@/types/candidate"
import type { Resume } from "@/types/resume"

function formatUploadDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatAts(score?: number | null) {
  if (score == null || Number.isNaN(Number(score))) return "—"
  return `${Math.round(Number(score))}%`
}

function candidateLabel(
  resume: Resume,
  candidatesById?: Map<string, Candidate>
) {
  const fromList = candidatesById?.get(resume.candidate_id)
  if (fromList?.full_name?.trim()) return fromList.full_name.trim()
  const name = (resume.candidate_name || "").trim()
  // Never surface a raw UUID as the candidate label
  const looksLikeId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      name
    )
  if (name && !looksLikeId && name.toLowerCase() !== "unknown candidate") {
    return name
  }
  if (fromList?.email) return fromList.email
  if (resume.candidate_email) return resume.candidate_email
  return "Unknown candidate"
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidateId, setCandidateId] = useState("")
  const [search, setSearch] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<Resume | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === candidateId) ?? null,
    [candidates, candidateId]
  )
  const candidatesById = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates]
  )
  const candidateSelectItems = useMemo(
    () => [
      { value: "__none__", label: "Select candidate" },
      ...candidates.map((c) => ({
        value: c.id,
        label: `${c.full_name} (${c.email})`,
      })),
    ],
    [candidates]
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const [resumeData, candidateData] = await Promise.all([
        resumesApi.list({
          page: 1,
          page_size: 100,
          search: search.trim() || undefined,
        }),
        candidatesApi.list({
          page: 1,
          page_size: 100,
          sort_by: "full_name",
          sort_order: "asc",
        }),
      ])
      setResumes(
        [...resumeData.items].sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        })
      )
      setTotal(resumeData.total)
      setCandidates(candidateData.items)
      if (!candidateId && candidateData.items[0]) {
        setCandidateId(candidateData.items[0].id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load resumes")
    }
  }, [candidateId, search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, search ? 250 : 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!candidateId) {
      setError("Select a candidate first.")
      return
    }
    if (!file) {
      setError(`Choose a resume file (${RESUME_FORMAT_LABEL}).`)
      return
    }
    const validationError = validateResumeFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(true)
    setProgress(0)
    try {
      const resume = await resumesApi.upload(
        {
          candidateId,
          file,
          isPrimary: true,
          replaceExisting: true,
        },
        setProgress
      )
      setFile(null)
      setSuccess(
        `Uploaded “${resume.file_name}” for ${candidateLabel(resume, candidatesById)}. Profile fields were not changed. Parsing runs only during AI Screening.`
      )
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  async function handleDownload(resume: Resume) {
    setError(null)
    try {
      await resumesApi.download(resume.id, resume.file_name)
    } catch (err) {
      if (resume.file_url && /^https?:\/\//i.test(resume.file_url)) {
        window.open(resume.file_url, "_blank", "noopener,noreferrer")
        return
      }
      setError(err instanceof ApiError ? err.message : "Download failed")
    }
  }

  async function openPreview(resume: Resume) {
    setError(null)
    setPreview(resume)
    setPreviewLoading(true)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    try {
      const lower = resume.file_name.toLowerCase()
      const isPdf =
        resume.file_type === "application/pdf" || lower.endsWith(".pdf")
      const isText =
        lower.endsWith(".txt") ||
        lower.endsWith(".rtf") ||
        (resume.file_type || "").includes("text/plain") ||
        (resume.file_type || "").includes("rtf")

      if (!isPdf && !isText) {
        setPreviewLoading(false)
        return
      }
      if (/^https?:\/\//i.test(resume.file_url) && isPdf) {
        setPreviewUrl(resume.file_url)
        setPreviewLoading(false)
        return
      }
      const blob = await resumesApi.fetchBlob(resume.id)
      if (isText) {
        const text = await blob.text()
        const textBlob = new Blob([text], { type: "text/plain" })
        const url = URL.createObjectURL(textBlob)
        setPreviewUrl(url)
        return
      }
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open resume preview")
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDelete(resume: Resume) {
    const name = candidateLabel(resume, candidatesById)
    const ok = window.confirm(
      `Delete resume “${resume.file_name}” for ${name}?`
    )
    if (!ok) return
    setError(null)
    try {
      await resumesApi.remove(resume.id)
      setSuccess(`Deleted “${resume.file_name}” for ${name}.`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed")
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Resumes"
          description="Upload and manage candidate resume files (PDF, DOC, DOCX, TXT, RTF). Upload stores the file only — profile data is never overwritten. AI parsing runs during Resume Screening."
          actions={
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
          }
        />
      </FadeIn>

      {error ? (
        <FadeIn>
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        </FadeIn>
      ) : null}
      {success ? (
        <FadeIn>
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {success}
          </p>
        </FadeIn>
      ) : null}

      <FadeIn>
        <form
          onSubmit={(e) => void handleUpload(e)}
          className="grid gap-4 rounded-xl border border-border/70 bg-card/80 p-4 shadow-none backdrop-blur md:grid-cols-2"
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="candidate">Candidate</Label>
            <Select
              value={candidateId || "__none__"}
              onValueChange={(value) =>
                setCandidateId(!value || value === "__none__" ? "" : value)
              }
              items={candidateSelectItems}
            >
              <SelectTrigger id="candidate" className="w-full">
                <SelectValue placeholder="Select candidate">
                  {(value) => {
                    if (!value || value === "__none__") return null
                    const match = candidates.find((c) => c.id === value)
                    return match
                      ? `${match.full_name} (${match.email})`
                      : selectedCandidate
                        ? `${selectedCandidate.full_name} (${selectedCandidate.email})`
                        : null
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" label="Select candidate">
                  Select candidate
                </SelectItem>
                {candidates.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    label={`${c.full_name} (${c.email})`}
                  >
                    {c.full_name} ({c.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCandidate ? (
              <p className="text-xs text-muted-foreground">
                Uploading for {selectedCandidate.full_name}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="resumeFile">Resume file</Label>
            <input
              id="resumeFile"
              type="file"
              accept={RESUME_ACCEPT}
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:border-ring/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {file ? (
              <p className="text-sm text-foreground">
                Selected: <span className="font-medium">{file.name}</span>{" "}
                <span className="text-muted-foreground">
                  ({formatBytes(file.size)})
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {RESUME_FORMAT_LABEL} · max {RESUME_MAX_SIZE_MB}MB
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 md:col-span-2">
            <p className="text-xs text-muted-foreground">
              Upload stores the file as <span className="font-medium">Latest</span>{" "}
              and replaces older resumes. Profile fields stay unchanged. Parsing
              happens only when you run AI Screening.
            </p>
            <Button type="submit" disabled={uploading || !file} className="ml-auto">
              <Upload data-icon="inline-start" />
              {uploading ? "Uploading…" : "Upload / Replace"}
            </Button>
          </div>

          {uploading ? (
            <div className="md:col-span-2">
              <Progress value={progress} label="Uploading resume" />
            </div>
          ) : null}
        </form>
      </FadeIn>

      <FadeIn>
        <div className="mb-3">
          <DataToolbar
            placeholder="Search by candidate name, email, or resume file…"
            value={search}
            onChange={setSearch}
          />
        </div>
        <AdminTableShell
          title={`${total} resume${total === 1 ? "" : "s"}`}
          description="Candidate name, resume file, upload date, ATS score, and applied jobs"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate Name</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead className="hidden md:table-cell">Upload Date</TableHead>
                <TableHead>ATS Score</TableHead>
                <TableHead className="hidden lg:table-cell">Applied Jobs</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="size-5 opacity-60" />
                      {search
                        ? "No resumes match your search."
                        : "No resumes yet — upload a file above"}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                resumes.map((row) => {
                  const name = candidateLabel(row, candidatesById)
                  const jobs = row.applied_jobs ?? []
                  return (
                    <TableRow key={row.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Link
                          href={`/candidates/${row.candidate_id}`}
                          className="font-medium hover:underline"
                        >
                          {name}
                        </Link>
                        {row.candidate_email ? (
                          <div className="text-xs text-muted-foreground">
                            {row.candidate_email}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.file_name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {row.is_primary ? (
                            <Badge variant="secondary">Latest</Badge>
                          ) : null}
                          <StatusBadge status={row.status} />
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {formatUploadDate(row.created_at)}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {formatAts(row.ats_score)}
                      </TableCell>
                      <TableCell className="hidden max-w-[260px] lg:table-cell">
                        {jobs.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            None
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {jobs.slice(0, 3).map((job) => (
                              <Link
                                key={job.application_id}
                                href={`/screening/${job.application_id}`}
                                className="inline-flex"
                              >
                                <Badge
                                  variant="outline"
                                  className="max-w-[140px] truncate"
                                  title={
                                    job.company_name
                                      ? `${job.job_title} · ${job.company_name}`
                                      : job.job_title
                                  }
                                >
                                  {job.job_title}
                                </Badge>
                              </Link>
                            ))}
                            {jobs.length > 3 ? (
                              <span className="text-xs text-muted-foreground">
                                +{jobs.length - 3} more
                              </span>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`View resume for ${name}`}
                            onClick={() => void openPreview(row)}
                          >
                            <Eye />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Download resume for ${name}`}
                            onClick={() => void handleDownload(row)}
                          >
                            <Download />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete resume for ${name}`}
                            onClick={() => void handleDelete(row)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </AdminTableShell>
      </FadeIn>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null)
            if (previewUrl && !/^https?:\/\//i.test(previewUrl)) {
              URL.revokeObjectURL(previewUrl)
            }
            setPreviewUrl(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {preview?.file_name ?? "Resume preview"}
            </DialogTitle>
            <DialogDescription>
              {preview
                ? `Candidate · ${candidateLabel(preview, candidatesById)}`
                : "Resume file details"}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-3">
              {previewLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Loading preview…
                </p>
              ) : previewUrl ? (
                <iframe
                  title={preview.file_name}
                  src={previewUrl}
                  className="h-[70vh] w-full rounded-lg border border-border bg-muted/20"
                />
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-8 text-center">
                  <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
                  <p className="font-medium">{preview.file_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Inline preview is available for PDF, TXT, and RTF. Use
                    Download to open DOC/DOCX files.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => void handleDownload(preview)}
                >
                  <Download data-icon="inline-start" />
                  Download
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
