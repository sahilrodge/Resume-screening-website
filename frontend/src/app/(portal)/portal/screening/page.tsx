"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { applicationsApi } from "@/services/applications"
import type { ApplicationMatch } from "@/types/application"
import { ApiError } from "@/types/api"

export default function PortalScreeningPage() {
  const [items, setItems] = useState<ApplicationMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    applicationsApi
      .mine({ page: 1, page_size: 50, sort_by: "match_score", sort_order: "desc" })
      .then((data) => {
        if (!cancelled) setItems(data.items)
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load screening results.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function downloadReport(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await applicationsApi.downloadReport(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download report")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Resume AI Screening
        </h1>
        <p className="text-sm text-muted-foreground">
          Match scores, ATS scores, skill gaps, and suggestions for your applications.
        </p>
      </header>

      {loading ? <PageSkeleton withHeader={false} rows={4} /> : null}
      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No screening results yet. Apply to open roles or wait for a recruiter to
          screen your resume.
        </p>
      ) : null}

      <ul className="divide-y divide-border">
        {items.map((app) => (
          <li key={app.id} className="space-y-3 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{app.job_title ?? "Untitled role"}</p>
                <p className="text-sm text-muted-foreground">
                  {app.company_name ?? "Company"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium tabular-nums">
                  {app.match_score != null
                    ? `${Math.round(app.match_score)}% match`
                    : "Pending"}
                  {app.ats_score != null ? ` · ATS ${Math.round(app.ats_score)}` : ""}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === app.id}
                  onClick={() => void downloadReport(app.id)}
                >
                  <Download data-icon="inline-start" />
                  Report
                </Button>
              </div>
            </div>
            {app.summary ? (
              <p className="text-sm text-muted-foreground">{app.summary}</p>
            ) : null}
            {(app.matching_skills?.length || app.missing_skills?.length) ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {app.matching_skills?.length ? (
                  <span>Matching: {app.matching_skills.join(", ")}</span>
                ) : null}
                {app.missing_skills?.length ? (
                  <span>Gaps: {app.missing_skills.join(", ")}</span>
                ) : null}
              </div>
            ) : null}
            {(app.suggestions ?? []).length ? (
              <p className="text-xs text-muted-foreground">
                Suggestions: {(app.suggestions ?? []).slice(0, 2).join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
