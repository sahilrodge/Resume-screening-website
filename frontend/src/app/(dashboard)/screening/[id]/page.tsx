"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, CalendarPlus, CheckCircle2, PhoneCall, XCircle } from "lucide-react"

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
import { voiceCallsApi } from "@/services/voice-calls"
import { ApiError } from "@/types/api"
import type { ApplicationMatch } from "@/types/application"
import { APPLICATION_STATUS_LABELS } from "@/types/application"
import type { VoiceCall } from "@/types/voice-call"

export default function ScreeningDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const apiLoading = useApiLoading()
  const [result, setResult] = useState<ApplicationMatch | null>(null)
  const [calls, setCalls] = useState<VoiceCall[]>([])
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [interviewAt, setInterviewAt] = useState("")
  const [meetingLink, setMeetingLink] = useState("")

  const load = useCallback(async () => {
    setError(null)
    try {
      const [data, callData] = await Promise.all([
        applicationsApi.get(id),
        voiceCallsApi.list({ application_id: id, page: 1, page_size: 10 }),
      ])
      setResult(data)
      setCalls(callData.items)
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
      const updated = await applicationsApi.updateStatus(id, {
        status,
        send_whatsapp: true,
      })
      setResult(updated)
      setNote(`Status set to ${label}. WhatsApp message queued/sent if Twilio is configured.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed")
    } finally {
      setBusy(false)
    }
  }

  async function triggerVapiCall() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await voiceCallsApi.trigger(id)
      await load()
      setNote("Vapi screening call initiated (requires candidate phone + Vapi credentials).")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start Vapi call")
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
        send_whatsapp: true,
      })
      await load()
      setNote("Interview invite created and WhatsApp invite sent (if Twilio is configured).")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule interview")
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
        description="Stored OpenAI screening result · WhatsApp actions below"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/screening" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="size-4" />
              Back
            </Link>
            <Link href="/whatsapp" className={buttonVariants({ variant: "outline" })}>
              WhatsApp log
            </Link>
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
              <h2 className="font-heading text-base font-semibold">WhatsApp actions</h2>
              <p className="text-sm text-muted-foreground">
                Candidate must have a phone number. Messages are stored in the WhatsApp log.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void updateStatus("rejected", "Rejected")}
                >
                  <XCircle className="size-4" />
                  Reject + notify
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void updateStatus("hired", "Selected")}
                >
                  <CheckCircle2 className="size-4" />
                  Select + notify
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void triggerVapiCall()}
                >
                  <PhoneCall className="size-4" />
                  Call with Vapi
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
                    Invite via WhatsApp
                  </Button>
                </div>
              </div>
            </section>
          </FadeIn>

          {calls.length ? (
            <FadeIn>
              <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-5">
                <h2 className="font-heading text-base font-semibold">Vapi screening calls</h2>
                <ul className="divide-y divide-border/60">
                  {calls.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-medium capitalize">{c.status.replaceAll("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.evaluation_summary
                            ? `${c.evaluation_summary.slice(0, 90)}…`
                            : c.transcript
                              ? "Transcript ready"
                              : "Waiting for completion"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-heading text-lg font-semibold tabular-nums">
                          {c.interview_score != null ? Math.round(c.interview_score) : "—"}
                        </span>
                        <Link
                          href={`/voice-calls/${c.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          View
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </FadeIn>
          ) : null}
        </>
      ) : null}
    </PageTransition>
  )
}
