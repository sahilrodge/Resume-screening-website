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
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { candidatesApi } from "@/services/candidates"
import { resumesApi } from "@/services/resumes"
import { ApiError } from "@/types/api"
import type { Candidate } from "@/types/candidate"
import type { Resume } from "@/types/resume"

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidateId, setCandidateId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isPrimary, setIsPrimary] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Resume | null>(null)

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === candidateId) ?? null,
    [candidates, candidateId]
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const [resumeData, candidateData] = await Promise.all([
        resumesApi.list({ page: 1, page_size: 50 }),
        candidatesApi.list({ page: 1, page_size: 100, sort_by: "full_name", sort_order: "asc" }),
      ])
      setResumes(resumeData.items)
      setCandidates(candidateData.items)
      if (!candidateId && candidateData.items[0]) {
        setCandidateId(candidateData.items[0].id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load resumes")
    }
  }, [candidateId])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!candidateId) {
      setError("Select a candidate first")
      return
    }
    if (!file) {
      setError("Choose a PDF file to upload")
      return
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are allowed")
      return
    }

    setUploading(true)
    try {
      const resume = await resumesApi.upload({
        candidateId,
        file,
        isPrimary,
      })
      setFile(null)
      setSuccess(
        resume.status === "parsed"
          ? "Resume uploaded and parsed with OpenAI"
          : resume.status === "failed"
            ? `Resume uploaded, but parsing failed${resume.parse_error ? `: ${resume.parse_error}` : ""}`
            : "Resume uploaded"
      )
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(resume: Resume) {
    setError(null)
    try {
      await resumesApi.download(resume.id, resume.file_name)
    } catch (err) {
      // Fallback: open Cloudinary URL directly
      window.open(resume.file_url, "_blank", "noopener,noreferrer")
      if (err instanceof Error && err.message) {
        // keep quiet if fallback works
      }
    }
  }

  async function handleDelete(resume: Resume) {
    const ok = window.confirm(`Delete resume "${resume.file_name}"?`)
    if (!ok) return
    setError(null)
    try {
      await resumesApi.remove(resume.id)
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
          description="Upload PDF resumes to Cloudinary, store paths in PostgreSQL, preview and download."
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
          onSubmit={handleUpload}
          className="grid gap-4 rounded-xl border border-border/70 bg-card/80 p-4 shadow-none backdrop-blur md:grid-cols-2"
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="candidate">Candidate</Label>
            <select
              id="candidate"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Select candidate</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.email})
                </option>
              ))}
            </select>
            {selectedCandidate ? (
              <p className="text-xs text-muted-foreground">
                Uploading for {selectedCandidate.full_name}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdf">PDF file</Label>
            <Input
              id="pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              PDF only · max 10MB · stored on Cloudinary
            </p>
          </div>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
              Set as primary resume
            </label>
            <Button type="submit" disabled={uploading} className="ml-auto">
              <Upload data-icon="inline-start" />
              {uploading ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>
        </form>
      </FadeIn>

      <FadeIn>
        <AdminTableShell
          title={`${resumes.length} resumes`}
          description="file_url + storage_path persisted in PostgreSQL"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="hidden md:table-cell">Candidate</TableHead>
                <TableHead className="hidden lg:table-cell">Storage path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="size-5 opacity-60" />
                      No resumes yet — upload a PDF above
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                resumes.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">{row.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.is_primary ? "Primary · " : ""}
                        {new Date(row.created_at).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div>
                        <Link
                          href={`/candidates/${row.candidate_id}`}
                          className="font-medium hover:underline"
                        >
                          {row.candidate_name || "—"}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.candidate_email}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] truncate text-xs text-muted-foreground lg:table-cell">
                      {row.storage_path || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Preview"
                          onClick={() => setPreview(row)}
                        >
                          <Eye />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Download"
                          onClick={() => void handleDownload(row)}
                        >
                          <Download />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete"
                          onClick={() => void handleDelete(row)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AdminTableShell>
      </FadeIn>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {preview?.file_name ?? "Resume preview"}
            </DialogTitle>
            <DialogDescription>
              Preview from Cloudinary · {preview?.candidate_name}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-3">
              <iframe
                title={preview.file_name}
                src={preview.file_url}
                className="h-[70vh] w-full rounded-lg border border-border bg-muted/20"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => void handleDownload(preview)}>
                  <Download data-icon="inline-start" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(preview.file_url, "_blank", "noopener,noreferrer")
                  }
                >
                  Open in new tab
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
