"use client"

import { useEffect, useRef, useState } from "react"
import {
  Download,
  Eye,
  FileText,
  Trash2,
  Upload,
} from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  formatBytes,
  RESUME_ACCEPT,
  RESUME_FORMAT_LABEL,
  RESUME_MAX_SIZE_MB,
  validateResumeFile,
} from "@/features/resumes/resume-upload"
import { cn } from "@/lib/utils"
import { resumesApi } from "@/services/resumes"
import { ApiError } from "@/types/api"

export type LatestResumeInfo = {
  id: string | null
  fileName: string | null
  status: string | null
  uploadedAt: string | null
  isPrimary?: boolean
  fileType?: string | null
}

type LatestResumePanelProps = {
  resume: LatestResumeInfo
  /** candidate = own /me APIs; staff = recruiter download/upload for a candidate */
  mode: "candidate" | "staff-readonly" | "staff-manage"
  candidateId?: string
  title?: string
  description?: string
  className?: string
  onChanged?: () => void | Promise<void>
  onMessage?: (message: string, kind: "success" | "error") => void
}

function formatUploadDate(value?: string | null) {
  if (!value) return null
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function isPdfResume(fileName?: string | null, fileType?: string | null) {
  if ((fileType || "").toLowerCase().includes("pdf")) return true
  return (fileName || "").toLowerCase().endsWith(".pdf")
}

function isTextPreviewable(fileName?: string | null, fileType?: string | null) {
  const name = (fileName || "").toLowerCase()
  const type = (fileType || "").toLowerCase()
  return (
    name.endsWith(".txt") ||
    name.endsWith(".rtf") ||
    type.includes("text/plain") ||
    type.includes("rtf")
  )
}

export function LatestResumePanel({
  resume,
  mode,
  candidateId,
  title = "Resume",
  description = `Upload a resume file (${RESUME_FORMAT_LABEL}, max ${RESUME_MAX_SIZE_MB}MB). Profile details are never changed by upload.`,
  className,
  onChanged,
  onMessage,
}: LatestResumePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [pendingSize, setPendingSize] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const canManage = mode === "candidate" || mode === "staff-manage"
  const displayName = pendingName || resume.fileName
  const uploadDate = formatUploadDate(resume.uploadedAt)
  const hasResume = Boolean(resume.id && resume.fileName)

  useEffect(() => {
    return () => {
      if (previewUrl && !/^https?:\/\//i.test(previewUrl)) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function notify(message: string, kind: "success" | "error") {
    onMessage?.(message, kind)
  }

  async function handleFile(file: File | null) {
    if (!file || !canManage) return
    const validationError = validateResumeFile(file)
    if (validationError) {
      notify(validationError, "error")
      return
    }
    if (mode === "staff-manage" && !candidateId) {
      notify("Select a candidate first.", "error")
      return
    }

    setPendingName(file.name)
    setPendingSize(file.size)
    setUploading(true)
    setProgress(0)
    try {
      if (mode === "candidate") {
        await resumesApi.uploadMine(
          { file, isPrimary: true, replaceExisting: true },
          setProgress
        )
      } else {
        await resumesApi.upload(
          {
            candidateId: candidateId!,
            file,
            isPrimary: true,
            replaceExisting: true,
          },
          setProgress
        )
      }
      notify(
        hasResume
          ? `Resume replaced with “${file.name}”. Your profile was not changed.`
          : `Resume “${file.name}” uploaded successfully. Your profile was not changed.`,
        "success"
      )
      await onChanged?.()
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Resume upload failed. Please try again.",
        "error"
      )
    } finally {
      setPendingName(null)
      setPendingSize(null)
      setUploading(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleDownload() {
    if (!resume.id) return
    setDownloading(true)
    try {
      if (mode === "candidate") {
        await resumesApi.downloadMine(resume.id, resume.fileName || undefined)
      } else {
        await resumesApi.download(resume.id, resume.fileName || undefined)
      }
      notify("Download started.", "success")
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Resume download failed",
        "error"
      )
    } finally {
      setDownloading(false)
    }
  }

  async function handlePreview() {
    if (!resume.id) return
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewText(null)
    if (previewUrl && !/^https?:\/\//i.test(previewUrl)) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)

    try {
      const blob =
        mode === "candidate"
          ? await resumesApi.fetchBlobMine(resume.id)
          : await resumesApi.fetchBlob(resume.id)

      if (isPdfResume(resume.fileName, resume.fileType)) {
        setPreviewUrl(URL.createObjectURL(blob))
        return
      }

      if (isTextPreviewable(resume.fileName, resume.fileType)) {
        setPreviewText(await blob.text())
        return
      }
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Could not open resume preview",
        "error"
      )
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDelete() {
    if (!resume.id || !canManage) return
    if (!window.confirm("Delete this resume? This cannot be undone.")) return
    setDeleting(true)
    try {
      if (mode === "candidate") {
        await resumesApi.removeMine(resume.id)
      } else {
        await resumesApi.remove(resume.id)
      }
      notify("Resume deleted successfully.", "success")
      await onChanged?.()
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Resume delete failed",
        "error"
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card className={cn("border-border/70 bg-card/80 shadow-none", className)}>
        <CardHeader>
          <CardTitle className="font-heading text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage ? (
            <div
              className={cn(
                "rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-5 transition-colors",
                dragOver && "border-primary bg-primary/5",
                uploading && "pointer-events-none opacity-70"
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                void handleFile(e.dataTransfer.files?.[0] ?? null)
              }}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload className="size-5 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {hasResume ? "Drop a file to replace your resume" : "Drop a resume here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {RESUME_FORMAT_LABEL} · max {RESUME_MAX_SIZE_MB}MB · no profile overwrite
                </p>
                <label
                  className={cn(
                    "mt-1 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                    uploading && "pointer-events-none opacity-60"
                  )}
                >
                  <Upload className="size-4" />
                  {hasResume ? "Replace resume" : "Upload resume"}
                  <input
                    ref={inputRef}
                    type="file"
                    accept={RESUME_ACCEPT}
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-1">
                {displayName ? (
                  <>
                    <p className="truncate font-medium">{displayName}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {resume.status ? <StatusBadge status={resume.status} /> : null}
                      {pendingSize != null ? (
                        <span>{formatBytes(pendingSize)}</span>
                      ) : null}
                      {uploadDate ? <span>· {uploadDate}</span> : null}
                      {uploading ? <span>· Uploading… {progress}%</span> : null}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No resume uploaded yet.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {hasResume ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={previewLoading || uploading}
                  onClick={() => void handlePreview()}
                >
                  <Eye className="size-4" />
                  Preview
                </Button>
              ) : null}

              {hasResume ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={downloading || uploading}
                  onClick={() => void handleDownload()}
                >
                  <Download className="size-4" />
                  {downloading ? "Opening…" : "Download"}
                </Button>
              ) : null}

              {canManage && hasResume ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleting || uploading}
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="size-4" />
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              ) : null}
            </div>
          </div>

          {uploading ? <Progress value={progress} label="Uploading resume" /> : null}
        </CardContent>
      </Card>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open)
          if (!open) {
            if (previewUrl && !/^https?:\/\//i.test(previewUrl)) {
              URL.revokeObjectURL(previewUrl)
            }
            setPreviewUrl(null)
            setPreviewText(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {resume.fileName ?? "Resume preview"}
            </DialogTitle>
            <DialogDescription>
              Preview only — profile fields are never updated from this file.
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Loading preview…
            </p>
          ) : previewUrl ? (
            <iframe
              title={resume.fileName || "Resume"}
              src={previewUrl}
              className="h-[70vh] w-full rounded-lg border border-border bg-muted/20"
            />
          ) : previewText != null ? (
            <pre className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted/20 p-4 text-xs whitespace-pre-wrap">
              {previewText}
            </pre>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-8 text-center">
              <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-medium">{resume.fileName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Inline preview is available for PDF, TXT, and RTF. Use Download
                for DOC/DOCX.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void handleDownload()}
              >
                <Download className="size-4" />
                Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
