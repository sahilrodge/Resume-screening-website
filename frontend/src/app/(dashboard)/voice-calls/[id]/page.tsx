"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiLoading } from "@/hooks/use-api-loading"
import { voiceCallsApi } from "@/services/voice-calls"
import { ApiError } from "@/types/api"
import type { VoiceCall } from "@/types/voice-call"

export default function VoiceCallDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const apiLoading = useApiLoading()
  const [call, setCall] = useState<VoiceCall | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setCall(await voiceCallsApi.get(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load call")
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PageTransition>
      <PageHeader
        title={call ? `${call.candidate_name ?? "Candidate"} · AI screen` : "Voice call"}
        description={call?.job_title || "Transcript and interview score"}
        actions={
          <div className="flex gap-2">
            <Link href="/voice-calls" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="size-4" />
              Back
            </Link>
            {call ? <StatusBadge status={call.status} /> : null}
          </div>
        }
      />

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!call && apiLoading ? <Skeleton className="h-48 w-full rounded-2xl" /> : null}

      {call ? (
        <div className="space-y-8">
          <FadeIn>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
                <p className="font-heading text-3xl font-semibold tabular-nums">
                  {call.interview_score != null ? Math.round(call.interview_score) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Recommendation
                </p>
                <p className="font-medium capitalize">{call.recommendation || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {call.duration_seconds != null ? `${call.duration_seconds}s` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                <p className="font-medium">{call.to_number}</p>
              </div>
            </div>
          </FadeIn>

          <Separator />

          <FadeIn>
            <section className="space-y-3">
              <h2 className="font-heading text-lg font-semibold">Screening questions</h2>
              {call.screening_questions.length ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {call.screening_questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Default questions used</p>
              )}
            </section>
          </FadeIn>

          <FadeIn>
            <section className="space-y-2">
              <h2 className="font-heading text-lg font-semibold">Evaluation summary</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {call.evaluation_summary || "Waiting for call completion + OpenAI evaluation."}
              </p>
              {call.meta && typeof call.meta === "object" && (call.meta as { evaluation?: { strengths?: string[]; gaps?: string[] } }).evaluation ? (
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Strengths</p>
                    <div className="flex flex-wrap gap-1.5">
                      {((call.meta as { evaluation: { strengths?: string[] } }).evaluation.strengths || []).map(
                        (s) => (
                          <Badge key={s} variant="secondary">
                            {s}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Gaps</p>
                    <div className="flex flex-wrap gap-1.5">
                      {((call.meta as { evaluation: { gaps?: string[] } }).evaluation.gaps || []).map(
                        (s) => (
                          <Badge key={s} variant="outline">
                            {s}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </FadeIn>

          <FadeIn>
            <section className="space-y-2">
              <h2 className="font-heading text-lg font-semibold">Transcript</h2>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
                {call.transcript || "Transcript will appear after the Vapi call ends."}
              </pre>
              {call.recording_url ? (
                <a
                  href={call.recording_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open recording
                </a>
              ) : null}
              {call.error_message ? (
                <p className="text-sm text-destructive">{call.error_message}</p>
              ) : null}
            </section>
          </FadeIn>
        </div>
      ) : null}
    </PageTransition>
  )
}
