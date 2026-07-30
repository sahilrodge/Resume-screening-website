"use client"

import { useEffect, useId, useState } from "react"

import { StatusBadge } from "@/components/admin/status-badge"
import { useToast } from "@/components/shared/toast"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
}

/** Recruiter/admin status control — persists via PATCH /interviews/{id}/status. */
export function InterviewStatusSelect({
  interview,
  onUpdated,
  className,
  showBadge = true,
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

  return (
    <div className={cn("grid gap-2 sm:max-w-xs", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={fieldId}>Status</Label>
        {showBadge ? <StatusBadge status={local.status} /> : null}
      </div>
      <Select
        value={local.status}
        disabled={busy}
        onValueChange={(value) => {
          if (value) void changeStatus(value as InterviewStatus)
        }}
      >
        <SelectTrigger id={fieldId} className="w-full bg-background">
          <SelectValue>
            {INTERVIEW_STATUS_LABELS[local.status] ?? local.status}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="z-[200]">
          {INTERVIEW_STATUSES.map((status) => (
            <SelectItem
              key={status}
              value={status}
              label={INTERVIEW_STATUS_LABELS[status]}
            >
              {INTERVIEW_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
