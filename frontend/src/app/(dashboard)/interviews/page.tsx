"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarPlus, Video } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { interviewsApi, type Interview } from "@/services/interviews"
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
          setError(err instanceof ApiError ? err.message : "Could not load interviews")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function setStatus(id: string, status: Interview["status"]) {
    setBusyId(id)
    setError(null)
    try {
      await interviewsApi.updateStatus(id, { status })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update interview")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Interviews"
          description="Schedule voice, video, and onsite interviews."
          actions={
            <Link href="/screening" className={buttonVariants()}>
              <CalendarPlus data-icon="inline-start" />
              Schedule
            </Link>
          }
        />
      </FadeIn>

      {error ? (
        <FadeIn>
          <Card className="border-destructive/40 bg-destructive/5 shadow-none">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        </FadeIn>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No interviews scheduled"
          description="Book interviews from shortlisted applications to see them here."
        />
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <FadeIn key={item.id}>
            <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="font-heading text-base">
                    {item.candidate_name || "Candidate"}
                  </CardTitle>
                  <CardDescription>
                    {item.job_title || "Role"}
                    {item.company_name ? ` · ${item.company_name}` : ""}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={item.interview_type} />
                  <StatusBadge status={item.status} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>{formatWhen(item.scheduled_at)}</span>
                <span>{item.duration_minutes} min</span>
                {item.application_id ? (
                  <Link
                    href={`/screening/${item.application_id}`}
                    className="text-primary hover:underline"
                  >
                    View application
                  </Link>
                ) : null}
                {item.status === "scheduled" || item.status === "rescheduled" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => void setStatus(item.id, "completed")}
                    >
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => void setStatus(item.id, "cancelled")}
                    >
                      Cancel
                    </Button>
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
