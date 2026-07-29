"use client"

import { useRef, useState } from "react"
import { Download, FileText, Trash2, Upload } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
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

export function LatestResumePanel({
  resume,
  mode,
  candidateId,
  title = "Resume",
  description = `Latest uploaded resume (${RESUME_FORMAT_LABEL}, max ${RESUME_MAX_SIZE_MB}MB).`,
  className,
  onChanged,
  onMessage,
}: LatestResumePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canManage = mode === "candidate" || mode === "staff-manage"
  const displayName = pendingName || resume.fileName
  const uploadDate = formatUploadDate(resume.uploadedAt)
  const hasResume = Boolean(resume.id && resume.fileName)

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
          ? `Resume replaced with “${file.name}”.`
          : `Resume “${file.name}” uploaded successfully.`,
        "success"
      )
      await onChanged?.()
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Resume upload failed",
        "error"
      )
    } finally {
      setPendingName(null)
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
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Resume download failed",
        "error"
      )
    } finally {
      setDownloading(false)
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
      notify("Resume deleted.", "success")
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
    <Card className={cn("border-border/70 bg-card/80 shadow-none", className)}>
      <CardHeader>
        <CardTitle className="font-heading text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 space-y-1">
              {displayName ? (
                <>
                  <p className="truncate font-medium">{displayName}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {resume.status ? <StatusBadge status={resume.status} /> : null}
                    <span>Latest</span>
                    {uploadDate ? <span>· {uploadDate}</span> : null}
                    {uploading ? <span>· Uploading…</span> : null}
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
            {canManage ? (
              <label
                className={cn(
                  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  uploading && "pointer-events-none opacity-60"
                )}
              >
                <Upload className="size-4" />
                {hasResume ? "Replace" : "Upload"}
                <input
                  ref={inputRef}
                  type="file"
                  accept={RESUME_ACCEPT}
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
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
  )
}
