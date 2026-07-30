"use client"

import { useEffect, useId, useState } from "react"

import { StatusBadge } from "@/components/admin/status-badge"
import { useToast } from "@/components/shared/toast"
import { Label } from "@/components/ui/label"
import {
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_STATUSES,
  interviewsApi,
  type Interview,
  type InterviewStatus,
} from "@/services/interviews"
import { ApiError } from "@/types/api"
import { cn } from "@/lib/utils"

type InterviewStatusSelectProps = {
  interview: Interview
  onUpdated?: (next: Interview) => void
  className?: string
  showBadge?: boolean
  /** When false, renders read-only badge (candidates). Default: editable. */
  editable?: boolean
}

/**
 * Interview status control — persists via PATCH /interviews/{id}/status.
 * Uses a native <select> so the control is always visible (Base UI Select
 * portals were easy to miss / fail inside transformed cards after scheduling).
 */
export function InterviewStatusSelect({
  interview,
  onUpdated,
  className,
  showBadge = true,
  editable = true,
}: InterviewStatusSelectProps) {
  const { toast } = useToast()
  const fieldId = useId()
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState(interview)

  useEffect(() => {
    setLocal(interview)
  }, [interview])

  async function changeStatus(status: InterviewStatus) {
    if (!status || status === local.status) return
    const previous = local
    setBusy(true)
    setLocal({ ...local, status })
    try {
      const updated = await interviewsApi.updateStatus(local.id, { status })
      setLocal(updated)
      onUpdated?.(updated)
      toast(
        `Interview status updated to ${INTERVIEW_STATUS_LABELS[status]}.`,
        "success"
      )
    } catch (err) {
      setLocal(previous)
      toast(
        err instanceof ApiError
          ? err.message
          : "Could not update interview status",
        "error"
      )
    } finally {
      setBusy(false)
    }
  }

  if (!editable) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <span className="text-sm font-medium text-foreground">
          Interview Status
        </span>
        <StatusBadge status={local.status} />
      </div>
    )
  }

  return (
    <div className={cn("grid gap-2 sm:max-w-xs", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={fieldId}>Interview Status</Label>
        {showBadge ? <StatusBadge status={local.status} /> : null}
      </div>
      <select
        id={fieldId}
        className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        value={local.status}
        disabled={busy}
        aria-label="Interview status"
        onChange={(event) => {
          void changeStatus(event.target.value as InterviewStatus)
        }}
      >
        {INTERVIEW_STATUSES.map((status) => (
          <option key={status} value={status}>
            {INTERVIEW_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  )
}
