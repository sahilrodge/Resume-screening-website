"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, CalendarPlus, CheckCircle2, Download, XCircle } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { MatchResultPanel } from "@/features/screening/match-result-panel"
import { useApiLoading } from "@/hooks/use-api-loading"
import { applicationsApi } from "@/services/applications"
import { interviewsApi } from "@/services/interviews"
import { ApiError } from "@/types/api"
import type { ApplicationMatch } from "@/types/application"
import { APPLICATION_STATUS_LABELS } from "@/types/application"

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

  async function updateStatus(status: string, label: string) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const updated = await applicationsApi.updateStatus(id, { status })
      setResult(updated)
      setNote(`Status set to ${label}.`)
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

  return (
    <PageTransition>
      <PageHeader
        title={
          result
            ? `${result.candidate_name ?? "Candidate"} vs ${result.job_title ?? "Job"}`
            : "Match details"
        }
        description="ATS score, job match, strengths, gaps, and actionable resume suggestions"
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
            {result ? (
              <StatusBadge status={APPLICATION_STATUS_LABELS[result.status]} />
            ) : null}
          </div>
        }
      />

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {note}
        </p>
      ) : null}

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
                Update status or schedule an interview for this candidate.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void updateStatus("rejected", "Rejected")}
                >
                  <XCircle className="size-4" />
                  Reject
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void updateStatus("hired", "Selected")}
                >
                  <CheckCircle2 className="size-4" />
                  Select
                </Button>
              </div>

              <div className="grid gap-3 border-t border-border/60 pt-4 md:grid-cols-[1fr_1fr_auto]">
                <div className="grid gap-2">
                  <Label htmlFor="interviewAt">Interview time</Label>
                  <Input
                    id="interviewAt"
                    type="datetime-local"
                    value={interviewAt}
                    onChange={(e) => setInterviewAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="meetingLink">Meeting link (optional)</Label>
                  <Input
                    id="meetingLink"
                    placeholder="https://meet.google.com/..."
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button disabled={busy} onClick={() => void inviteInterview()}>
                    <CalendarPlus className="size-4" />
                    Schedule interview
                  </Button>
                </div>
              </div>
            </section>
          </FadeIn>
        </>
      ) : null}
    </PageTransition>
  )
}
