"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarPlus, Video } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { EmptyState } from "@/components/shared/empty-state"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { useToast } from "@/components/shared/toast"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { InterviewTimeline } from "@/features/interviews/interview-timeline"
import {
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_STATUSES,
  interviewsApi,
  type Interview,
  type InterviewStatus,
} from "@/services/interviews"
import { ApiError } from "@/types/api"

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

export default function InterviewsPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<Interview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const res = await interviewsApi.list({ page_size: 50 })
    setItems(res.items ?? [])
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void load()
      .then(() => {
        if (!cancelled) setError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setItems([])
          setError(
            err instanceof ApiError ? err.message : "Could not load interviews"
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function setStatus(id: string, status: InterviewStatus) {
    const previous = items.find((item) => item.id === id)
    if (!previous || previous.status === status) return

    setBusyId(id)
    setError(null)
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item))
    )

    try {
      const updated = await interviewsApi.updateStatus(id, { status })
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...updated } : item))
      )
      toast(
        `Interview status updated to ${INTERVIEW_STATUS_LABELS[status]}.`,
        "success"
      )
    } catch (err) {
      setItems((current) =>
        current.map((item) => (item.id === id ? previous : item))
      )
      const message =
        err instanceof ApiError ? err.message : "Could not update interview"
      setError(message)
      toast(message, "error")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Interviews"
          description="Manage interview status, timeline, and outcomes for every candidate."
          actions={
            <Link href="/screening" className={buttonVariants()}>
              <CalendarPlus data-icon="inline-start" />
              Schedule
            </Link>
          }
        />
      </FadeIn>

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      {loading ? <PageSkeleton withHeader={false} rows={4} /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No interviews scheduled"
          description="Book interviews from screened applications to track status here."
          action={
            <Link href="/screening" className={buttonVariants()}>
              Go to screening
            </Link>
          }
        />
      ) : null}

      <div className="space-y-4">
        {items.map((item) => (
          <FadeIn key={item.id}>
            <Card className="border-border/70 bg-card/80 shadow-none">
              <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="font-heading text-base">
                    {item.candidate_name || "Candidate"}
                  </CardTitle>
                  <CardDescription>
                    {item.job_title || "Role"}
                    {item.company_name ? ` · ${item.company_name}` : ""}
                  </CardDescription>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatWhen(item.scheduled_at)}</span>
                    <span>{item.duration_minutes} min</span>
                    {item.status_changed_at ? (
                      <span>
                        Status changed {formatWhen(item.status_changed_at)}
                      </span>
                    ) : null}
                    {item.application_id ? (
                      <Link
                        href={`/screening/${item.application_id}`}
                        className="text-primary hover:underline"
                      >
                        View application
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.interview_type} />
                  <StatusBadge status={item.status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:max-w-xs">
                  <Label htmlFor={`interview-status-${item.id}`}>Status</Label>
                  <select
                    id={`interview-status-${item.id}`}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                    value={item.status}
                    disabled={busyId === item.id}
                    onChange={(event) => {
                      void setStatus(
                        item.id,
                        event.target.value as InterviewStatus
                      )
                    }}
                  >
                    {INTERVIEW_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {INTERVIEW_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>

                {item.timeline?.length ? (
                  <div className="rounded-xl border border-border/60 bg-background/50 p-3 sm:p-4">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Interview timeline
                    </p>
                    <InterviewTimeline steps={item.timeline} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>
    </PageTransition>
  )
}
