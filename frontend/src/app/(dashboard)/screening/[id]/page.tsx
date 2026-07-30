"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, CalendarPlus, CheckCircle2, Download, XCircle } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { MatchResultPanel } from "@/features/screening/match-result-panel"
import { useApiLoading } from "@/hooks/use-api-loading"
import { cn } from "@/lib/utils"
import { applicationsApi } from "@/services/applications"
import { interviewsApi } from "@/services/interviews"
import { ApiError } from "@/types/api"
import type { ApplicationMatch, ApplicationStatus } from "@/types/application"
import { APPLICATION_STATUS_LABELS } from "@/types/application"

type DecisionAction = "selected" | "rejected"

function isSelectedStatus(status: ApplicationStatus) {
  return status === "selected" || status === "hired" || status === "offered"
}

function isRejectedStatus(status: ApplicationStatus) {
  return status === "rejected"
}

export default function ScreeningDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const apiLoading = useApiLoading()
  const [result, setResult] = useState<ApplicationMatch | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [interviewAt, setInterviewAt] = useState("")
  const [meetingLink, setMeetingLink] = useState("")
  const [confirmAction, setConfirmAction] = useState<DecisionAction | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await applicationsApi.get(id)
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load match result")
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function applyDecision(action: DecisionAction) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const updated = await applicationsApi.updateStatus(id, { status: action })
      setResult(updated)
      setNote(
        action === "selected"
          ? "Candidate marked as Selected."
          : "Candidate marked as Rejected."
      )
      setConfirmAction(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed")
    } finally {
      setBusy(false)
    }
  }

  async function inviteInterview() {
    if (!interviewAt) {
      setError("Pick an interview date/time")
      return
    }
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await interviewsApi.create({
        application_id: id,
        scheduled_at: new Date(interviewAt).toISOString(),
        meeting_link: meetingLink.trim() || undefined,
        interview_type: "video",
      })
      await load()
      setNote("Interview scheduled. Notifications sent via email/in-app when configured.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule interview")
    } finally {
      setBusy(false)
    }
  }

  async function downloadReport() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await applicationsApi.downloadReport(id)
      setNote("Screening report downloaded.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download report")
    } finally {
      setBusy(false)
    }
  }

  const selected = result ? isSelectedStatus(result.status) : false
  const rejected = result ? isRejectedStatus(result.status) : false
  const decided = selected || rejected
  const badgeStatus =
    result == null
      ? null
      : selected
        ? "Selected"
        : rejected
          ? "Rejected"
          : APPLICATION_STATUS_LABELS[result.status]

  return (
    <PageTransition>
      <PageHeader
        title={
          result
            ? `${result.candidate_name ?? "Candidate"} · ${
                result.company_name
                  ? `${result.company_name} - ${result.job_title ?? "Job"}`
                  : result.job_title ?? "Job"
              }`
            : "Match details"
        }
        description="ATS score, missing skills, candidate strengths, and resume suggestions"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/screening" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="size-4" />
              Back
            </Link>
            {result ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void downloadReport()}
              >
                <Download className="size-4" />
                Download report
              </Button>
            ) : null}
            {badgeStatus ? <StatusBadge status={badgeStatus} /> : null}
          </div>
        }
      />

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {note ? <InlineAlert variant="success">{note}</InlineAlert> : null}

      {!result && apiLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : null}

      {result ? (
        <>
          <FadeIn>
            <MatchResultPanel result={result} />
          </FadeIn>

          <FadeIn>
            <section className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-5">
              <h2 className="font-heading text-base font-semibold">Actions</h2>
              <p className="text-sm text-muted-foreground">
                Select or reject this candidate after reviewing the screening result.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={rejected ? "destructive" : "outline"}
                  className={cn(
                    rejected &&
                      "bg-rose-600 text-white hover:bg-rose-600/90 disabled:opacity-100"
                  )}
                  disabled={busy || selected}
                  onClick={() => {
                    if (!rejected) setConfirmAction("rejected")
                  }}
                >
                  <XCircle className="size-4" />
                  {rejected ? "Rejected" : "Reject"}
                </Button>
                <Button
                  className={cn(
                    selected &&
                      "bg-emerald-600 text-white hover:bg-emerald-600/90 disabled:opacity-100"
                  )}
                  disabled={busy || rejected}
                  onClick={() => {
                    if (!selected) setConfirmAction("selected")
                  }}
                >
                  <CheckCircle2 className="size-4" />
                  {selected ? "Selected" : "Select"}
                </Button>
              </div>

              {decided ? (
                <p className="text-xs text-muted-foreground">
                  Decision saved. The opposite action is disabled.
                </p>
              ) : null}

              <div className="grid gap-3 border-t border-border/60 pt-4 md:grid-cols-[1fr_1fr_auto]">
                <div className="grid gap-2">
                  <Label htmlFor="interviewAt">Interview time</Label>
                  <Input
                    id="interviewAt"
                    type="datetime-local"
                    value={interviewAt}
                    onChange={(e) => setInterviewAt(e.target.value)}
                    disabled={rejected}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="meetingLink">Meeting link (optional)</Label>
                  <Input
                    id="meetingLink"
                    placeholder="https://meet.google.com/..."
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    disabled={rejected}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    disabled={busy || rejected}
                    onClick={() => void inviteInterview()}
                  >
                    <CalendarPlus className="size-4" />
                    Schedule interview
                  </Button>
                </div>
              </div>
            </section>
          </FadeIn>
        </>
      ) : null}

      <Dialog
        open={confirmAction != null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmAction(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "selected" ? "Select candidate" : "Reject candidate"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "selected"
                ? "Are you sure you want to SELECT this candidate?"
                : "Are you sure you want to REJECT this candidate?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction === "rejected" ? "destructive" : "default"}
              disabled={busy}
              onClick={() => {
                if (confirmAction) void applyDecision(confirmAction)
              }}
            >
              {busy
                ? "Saving…"
                : confirmAction === "selected"
                  ? "Yes, Select"
                  : "Yes, Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
