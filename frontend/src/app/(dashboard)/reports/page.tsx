"use client"

import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { analyticsApi } from "@/services/analytics"
import type { AnalyticsOverview } from "@/types/analytics"

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "")
          if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
          return value
        })
        .join(",")
    )
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    analyticsApi
      .overview()
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setError("Could not load report metrics.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cards = [
    {
      title: "Applications",
      value: data?.kpis.total_applications,
      description: "Total applications recorded",
    },
    {
      title: "Open jobs",
      value: data?.kpis.open_jobs,
      description: "Active openings",
    },
    {
      title: "Hires",
      value: data?.kpis.total_hires,
      description: "Successful placements",
    },
    {
      title: "Avg match",
      value:
        data?.kpis.avg_match_score != null
          ? `${Math.round(data.kpis.avg_match_score)}%`
          : undefined,
      description: "Average resume-job match score",
    },
  ]

  const exportRows = useMemo(() => {
    if (!data) return null
    const rows: string[][] = [
      ["section", "metric", "value"],
      ["kpi", "total_applications", String(data.kpis.total_applications)],
      ["kpi", "open_jobs", String(data.kpis.open_jobs)],
      ["kpi", "total_hires", String(data.kpis.total_hires)],
      [
        "kpi",
        "avg_match_score",
        data.kpis.avg_match_score != null
          ? String(data.kpis.avg_match_score)
          : "",
      ],
    ]
    for (const stage of data.hiring_funnel?.stages ?? []) {
      rows.push(["funnel", stage.status, String(stage.count)])
    }
    for (const job of data.job_performance ?? []) {
      rows.push([
        "job",
        job.title,
        `apps=${job.applications};hires=${job.hires};avg_match=${job.avg_match_score ?? ""}`,
      ])
    }
    for (const rec of data.recruiter_performance ?? []) {
      rows.push([
        "recruiter",
        rec.name,
        `open=${rec.open_jobs};hires=${rec.hires};apps=${rec.applications}`,
      ])
    }
    return rows
  }, [data])

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Reports"
          description="High-level hiring metrics for leadership review."
          actions={
            <Button
              disabled={!exportRows}
              onClick={() =>
                exportRows &&
                downloadCsv(
                  `hirepulse-report-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportRows
                )
              }
            >
              <Download data-icon="inline-start" />
              Export CSV
            </Button>
          }
        />
      </FadeIn>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reports…</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <FadeIn key={card.title}>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{card.title}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {card.value ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>

      {data?.hiring_funnel?.stages?.length ? (
        <FadeIn>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pipeline funnel</CardTitle>
              <CardDescription>Application status distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {data.hiring_funnel.stages.map((step) => (
                  <li
                    key={step.status}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <span>{step.label || step.status.replaceAll("_", " ")}</span>
                    <span className="font-medium tabular-nums">{step.count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      ) : null}

      {data?.job_performance?.length ? (
        <FadeIn>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Job performance</CardTitle>
              <CardDescription>Applications and hires by role</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {data.job_performance.slice(0, 12).map((job) => (
                  <li
                    key={job.job_id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span className="truncate">{job.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {job.applications} apps · {job.hires} hires
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      ) : null}
    </PageTransition>
  )
}
