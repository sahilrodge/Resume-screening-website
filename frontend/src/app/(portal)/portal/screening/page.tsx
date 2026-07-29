"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { useCandidateSync } from "@/features/candidate/candidate-sync-provider"
import { applicationsApi } from "@/services/applications"
import { ApiError } from "@/types/api"

export default function PortalScreeningPage() {
  const { applications, loading, error: syncError } = useCandidateSync()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const items = useMemo(() => {
    return [...applications].sort((a, b) => {
      const aScore = a.match_score ?? -1
      const bScore = b.match_score ?? -1
      return bScore - aScore
    })
  }, [applications])

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

  const displayError = error || syncError

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
      {displayError ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {displayError}
        </p>
      ) : null}
      {!loading && !displayError && items.length === 0 ? (
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
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                  {app.scoring_engine === "openai"
                    ? "AI Score"
                    : app.scoring_engine === "local"
                      ? "Local Analysis"
                      : "Pending"}
                </span>
                <span>
                  Match{" "}
                  <strong>
                    {app.match_score != null ? `${Math.round(app.match_score)}%` : "—"}
                  </strong>
                </span>
                <span>
                  ATS{" "}
                  <strong>
                    {app.ats_score != null ? `${Math.round(app.ats_score)}%` : "—"}
                  </strong>
                </span>
                {app.confidence != null ? (
                  <span className="text-muted-foreground">
                    Confidence {Math.round(app.confidence)}%
                  </span>
                ) : null}
              </div>
            </div>
            {app.summary ? (
              <p className="text-sm text-muted-foreground">{app.summary}</p>
            ) : null}
            {app.matching_skills?.length ? (
              <p className="text-xs text-muted-foreground">
                Matching: {app.matching_skills.slice(0, 8).join(", ")}
              </p>
            ) : null}
            {app.missing_skills?.length ? (
              <p className="text-xs text-muted-foreground">
                Gaps: {app.missing_skills.slice(0, 8).join(", ")}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busyId === app.id}
              onClick={() => void downloadReport(app.id)}
            >
              <Download className="size-3.5" />
              {busyId === app.id ? "Downloading…" : "Download report"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
