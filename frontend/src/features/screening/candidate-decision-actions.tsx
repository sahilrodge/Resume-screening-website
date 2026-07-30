"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useToast } from "@/components/shared/toast"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { applicationsApi } from "@/services/applications"
import { ApiError } from "@/types/api"
import type { ApplicationMatch, ApplicationStatus } from "@/types/application"
import { APPLICATION_STATUS_LABELS } from "@/types/application"

type Decision = "selected" | "rejected"

function isSelectedStatus(status: ApplicationStatus) {
  return status === "selected" || status === "hired" || status === "offered"
}

function isRejectedStatus(status: ApplicationStatus) {
  return status === "rejected"
}

function displayBadge(status: ApplicationStatus) {
  if (isSelectedStatus(status)) return "Selected"
  if (isRejectedStatus(status)) return "Rejected"
  return APPLICATION_STATUS_LABELS[status] ?? status
}

type CandidateDecisionActionsProps = {
  application: ApplicationMatch
  onUpdated?: (next: ApplicationMatch) => void
  className?: string
  showBadge?: boolean
}

export function CandidateDecisionActions({
  application,
  onUpdated,
  className,
  showBadge = true,
}: CandidateDecisionActionsProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Decision | null>(null)
  const [local, setLocal] = useState(application)

  useEffect(() => {
    setLocal(application)
  }, [application])

  const selected = isSelectedStatus(local.status)
  const rejected = isRejectedStatus(local.status)

  const closeConfirm = useCallback(() => {
    if (!busy) setConfirm(null)
  }, [busy])

  async function applyDecision(decision: Decision) {
    setBusy(true)
    try {
      const updated = await applicationsApi.updateStatus(local.id, {
        status: decision,
      })
      setLocal(updated)
      onUpdated?.(updated)
      setConfirm(null)
      toast(
        decision === "selected"
          ? "Candidate selected for the next stage."
          : "Candidate rejected.",
        "success"
      )
    } catch (err) {
      toast(
        err instanceof ApiError
          ? err.message
          : "Could not update application status",
        "error"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {showBadge ? <StatusBadge status={displayBadge(local.status)} /> : null}
        <Button
          type="button"
          variant={rejected ? "destructive" : "outline"}
          className={cn(
            rejected &&
              "bg-rose-600 text-white hover:bg-rose-600/90 disabled:opacity-100"
          )}
          disabled={busy || selected}
          onClick={() => {
            if (!rejected) setConfirm("rejected")
          }}
        >
          <XCircle className="size-4" />
          {rejected ? "Rejected" : "Reject"}
        </Button>
        <Button
          type="button"
          className={cn(
            selected &&
              "bg-emerald-600 text-white hover:bg-emerald-600/90 disabled:opacity-100"
          )}
          disabled={busy || rejected}
          onClick={() => {
            if (!selected) setConfirm("selected")
          }}
        >
          <CheckCircle2 className="size-4" />
          {selected ? "Selected" : "Select"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm != null}
        title={confirm === "selected" ? "Select candidate" : "Reject candidate"}
        description={
          confirm === "selected"
            ? "Are you sure you want to select this candidate for the next stage?"
            : "Are you sure you want to reject this candidate?"
        }
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        confirmVariant={confirm === "rejected" ? "destructive" : "default"}
        busy={busy}
        onCancel={closeConfirm}
        onConfirm={() => {
          if (confirm) void applyDecision(confirm)
        }}
      />
    </div>
  )
}

export { isSelectedStatus, isRejectedStatus, displayBadge }
