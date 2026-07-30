"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, CalendarPlus, Download } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
import { useToast } from "@/components/shared/toast"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { CandidateDecisionActions } from "@/features/screening/candidate-decision-actions"
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
  const { toast } = useToast()
  const [result, setResult] = useState<ApplicationMatch | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  async function inviteInterview() {
    if (!interviewAt) {
      setError("Pick an interview date/time")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await interviewsApi.create({
        application_id: id,
        scheduled_at: new Date(interviewAt).toISOString(),
        meeting_link: meetingLink.trim() || undefined,
        interview_type: "video",
      })
      await load()
      toast("Interview scheduled successfully.", "success")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule interview")
    } finally {
      setBusy(false)
    }
  }

  async function downloadReport() {
    setBusy(true)
    setError(null)
    try {
      await applicationsApi.downloadReport(id)
      toast("Screening report downloaded.", "success")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download report")
    } finally {
      setBusy(false)
    }
  }

  const badgeLabel = result
    ? result.status === "selected" ||
      result.status === "hired" ||
      result.status === "offered"
      ? "Selected"
      : result.status === "rejected"
        ? "Rejected"
        : APPLICATION_STATUS_LABELS[result.status]
    : null

  const rejected = result?.status === "rejected"

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
            {badgeLabel ? <StatusBadge status={badgeLabel} /> : null}
          </div>
        }
      />

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

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
              <h2 className="font-heading text-base font-semibold">
                Candidate decision
              </h2>
              <p className="text-sm text-muted-foreground">
                Select or reject this candidate. Confirmation is required before
                the application status is updated.
              </p>

              <CandidateDecisionActions
                application={result}
                showBadge={false}
                onUpdated={setResult}
              />

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
    </PageTransition>
  )
}
