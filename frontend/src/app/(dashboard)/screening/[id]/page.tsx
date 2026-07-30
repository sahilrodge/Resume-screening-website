"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, CalendarPlus, Download } from "lucide-react"

import { ApplicationStatusBadge } from "@/components/shared/application-status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
import { useToast } from "@/components/shared/toast"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { CandidateDecisionActions } from "@/features/screening/candidate-decision-actions"
import { InterviewStatusSelect } from "@/features/interviews/interview-status-select"
import { InterviewTimeline } from "@/features/interviews/interview-timeline"
import { MatchResultPanel } from "@/features/screening/match-result-panel"
import { useApiLoading } from "@/hooks/use-api-loading"
import {
  publishApplicationStatusChange,
  subscribeApplicationStatusChange,
} from "@/lib/application-status-events"
import { applicationsApi } from "@/services/applications"
import { interviewsApi, type Interview } from "@/services/interviews"
import { ApiError } from "@/types/api"
import type { ApplicationMatch } from "@/types/application"

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function ScreeningDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const apiLoading = useApiLoading()
  const { toast } = useToast()
  const [result, setResult] = useState<ApplicationMatch | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [interviewAt, setInterviewAt] = useState("")
  const [meetingLink, setMeetingLink] = useState("")

  const loadInterviews = useCallback(async () => {
    const data = await interviewsApi.list({
      application_id: id,
      page_size: 20,
    })
    setInterviews(data.items ?? [])
  }, [id])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [data] = await Promise.all([
        applicationsApi.get(id),
        // Soft-fail interviews so a list error does not wipe cards that
        // already show the status dropdown after scheduling.
        loadInterviews().catch(() => undefined),
      ])
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load match result")
    }
  }, [id, loadInterviews])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return subscribeApplicationStatusChange(({ applicationId, status }) => {
      if (applicationId !== id) return
      setResult((current) =>
        current ? { ...current, status } : current
      )
      setInterviews((current) =>
        current.map((row) =>
          row.application_id === applicationId
            ? { ...row, application_status: status }
            : row
        )
      )
    })
  }, [id])

  async function inviteInterview() {
    if (!interviewAt) {
      setError("Pick an interview date/time")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await interviewsApi.create({
        application_id: id,
        scheduled_at: new Date(interviewAt).toISOString(),
        meeting_link: meetingLink.trim() || undefined,
        interview_type: "video",
      })
      setInterviews((current) => [created, ...current])
      if (created.application_status) {
        publishApplicationStatusChange({
          applicationId: id,
          status: created.application_status,
          interviewId: created.id,
        })
      }
      await load()
      setInterviewAt("")
      setMeetingLink("")
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
            {result ? <ApplicationStatusBadge status={result.status} /> : null}
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

              <div className="space-y-4 border-t border-border/60 pt-4">
                <div>
                  <h3 className="font-heading text-sm font-semibold">Interview</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Schedule an interview, then set Interview Status from the
                    dropdown on each interview card. Changes save immediately.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
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

                {interviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No interviews scheduled yet for this application.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {interviews.map((item) => (
                      <li
                        key={item.id}
                        className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3 sm:p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 text-sm">
                            <p className="font-medium">
                              {formatWhen(item.scheduled_at)}
                              <span className="text-muted-foreground">
                                {" "}
                                · {item.duration_minutes} min
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {item.interview_type}
                              {item.meeting_link ? " · meeting link set" : ""}
                            </p>
                          </div>
                        </div>

                        <InterviewStatusSelect
                          interview={item}
                          onUpdated={(updated) => {
                            setInterviews((current) =>
                              current.map((row) =>
                                row.id === updated.id
                                  ? { ...row, ...updated }
                                  : row
                              )
                            )
                            // Selected/Rejected (and other syncs) update the
                            // application row — refresh so badges stay in sync.
                            void applicationsApi
                              .get(id)
                              .then(setResult)
                              .catch(() => undefined)
                          }}
                        />

                        {item.timeline?.length ? (
                          <InterviewTimeline steps={item.timeline} />
                        ) : null}

                        <Link
                          href="/interviews"
                          className="text-xs text-primary hover:underline"
                        >
                          Open Interviews
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </FadeIn>
        </>
      ) : null}
    </PageTransition>
  )
}
