"use client"

import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { analyticsApi } from "@/services/analytics"
import type { AnalyticsOverview } from "@/types/analytics"

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
}

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function formatPct(value: number | null | undefined) {
  if (value == null) return "—"
  return `${Math.round(value * 100)}%`
}

function formatScore(value: number | null | undefined) {
  if (value == null) return "—"
  return value.toFixed(1)
}

function ChartEmpty({ message = "No data yet" }: { message?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void analyticsApi
      .overview(6)
      .then((res) => {
        if (!cancelled) {
          setData(res)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setError("Could not load analytics. Sign in as a recruiter and try again.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const kpis = data
    ? [
        {
          label: "Applications",
          value: String(data.kpis.total_applications),
          note: `${data.kpis.open_jobs} open jobs`,
        },
        {
          label: "Time to hire",
          value:
            data.kpis.avg_time_to_hire_days != null
              ? `${data.kpis.avg_time_to_hire_days} days`
              : "—",
          note: `${data.kpis.total_hires} hires`,
        },
        {
          label: "Offer accept rate",
          value: formatPct(data.kpis.offer_accept_rate),
          note: "Hired / (hired + offered)",
        },
        {
          label: "AI match score",
          value: formatScore(data.kpis.avg_match_score),
          note: formatPct(data.kpis.screen_to_interview_rate) + " screen→interview",
        },
      ]
    : [
        { label: "Applications", value: "—", note: loading ? "Loading…" : "—" },
        { label: "Time to hire", value: "—", note: loading ? "Loading…" : "—" },
        { label: "Offer accept rate", value: "—", note: loading ? "Loading…" : "—" },
        { label: "AI match score", value: "—", note: loading ? "Loading…" : "—" },
      ]

  const jobChart = (data?.job_performance ?? []).map((j) => ({
    name: j.title.length > 18 ? `${j.title.slice(0, 16)}…` : j.title,
    applications: j.applications,
    hires: j.hires,
    avg_match: j.avg_match_score ?? 0,
  }))

  const recruiterChart = (data?.recruiter_performance ?? []).map((r) => ({
    name: r.name.split(" ")[0] || r.name,
    hires: r.hires,
    applications: r.applications,
    interviews: r.interviews,
  }))

  const funnelData = data?.hiring_funnel?.stages ?? []
  const matchBuckets = data?.match_scores?.buckets ?? []
  const interviewStatus = data?.interview_results?.by_status ?? []
  const interviewType = data?.interview_results?.by_type ?? []

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Analytics"
          description="Applications, funnel health, job and recruiter performance, AI match scores, and hiring trends."
        />
      </FadeIn>

      {error ? (
        <FadeIn>
          <Card className="border-destructive/40 bg-destructive/5 shadow-none">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Card
              key={kpi.label}
              className="border-border/70 bg-card/80 shadow-none backdrop-blur transition-transform duration-300 hover:-translate-y-0.5"
            >
              <CardHeader className="pb-2">
                <CardDescription>{kpi.label}</CardDescription>
                <CardTitle className="font-heading text-2xl">{kpi.value}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">{kpi.note}</CardContent>
            </Card>
          ))}
        </div>
      </FadeIn>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Applications */}
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Applications</CardTitle>
              <CardDescription>Volume vs AI-screened resumes</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {!data?.applications?.length ? (
                <ChartEmpty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.applications}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      name="Applications"
                      stroke="var(--chart-1)"
                      fill="var(--chart-1)"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="screened"
                      name="AI screened"
                      stroke="var(--chart-2)"
                      fill="var(--chart-2)"
                      fillOpacity={0.22}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Hiring Funnel */}
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Hiring Funnel</CardTitle>
              <CardDescription>
                Pipeline stages
                {data?.hiring_funnel
                  ? ` · ${data.hiring_funnel.rejected} rejected · ${data.hiring_funnel.withdrawn} withdrawn`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {!funnelData.some((s) => s.count > 0) ? (
                <ChartEmpty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={88}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Candidates" radius={[0, 8, 8, 0]}>
                      {funnelData.map((_, i) => (
                        <Cell key={funnelData[i].status} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Job Performance */}
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Job Performance</CardTitle>
              <CardDescription>Applications and hires by role</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {!jobChart.length ? (
                <ChartEmpty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jobChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={56} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="applications" name="Applications" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="hires" name="Hires" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Recruiter Performance */}
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Recruiter Performance</CardTitle>
              <CardDescription>Hires, interviews, and applications</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {!recruiterChart.length ? (
                <ChartEmpty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recruiterChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="applications" name="Applications" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="interviews" name="Interviews" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="hires" name="Hires" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* AI Match Score */}
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">AI Match Score</CardTitle>
              <CardDescription>
                Score distribution
                {data?.match_scores
                  ? ` · avg ${formatScore(data.match_scores.avg_score)} · ${data.match_scores.scored_applications} scored`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {!matchBuckets.some((b) => b.count > 0) ? (
                <ChartEmpty message="No scored applications yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={matchBuckets}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="range" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Applications" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Interview Results */}
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Interview Results</CardTitle>
              <CardDescription>
                By status
                {data?.interview_results?.avg_rating != null
                  ? ` · avg rating ${data.interview_results.avg_rating}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {!interviewStatus.length && !interviewType.length ? (
                <ChartEmpty message="No interviews yet" />
              ) : (
                <div className="grid h-full grid-cols-2 gap-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={interviewStatus}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={3}
                      >
                        {interviewStatus.map((entry, index) => (
                          <Cell
                            key={entry.status}
                            fill={chartColors[index % chartColors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col justify-center gap-2 text-xs">
                    {interviewStatus.map((s, i) => (
                      <div key={s.status} className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: chartColors[i % chartColors.length] }}
                        />
                        <span className="text-muted-foreground">
                          {s.label} · {s.count}
                        </span>
                      </div>
                    ))}
                    {interviewType.map((t) => (
                      <div key={t.interview_type} className="text-muted-foreground">
                        {t.label}: {t.count}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Monthly Hiring — full width */}
      <FadeIn>
        <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
          <CardHeader>
            <CardTitle className="font-heading">Monthly Hiring</CardTitle>
            <CardDescription>Applications, interviews, offers, and hires</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {!data?.monthly_hiring?.length ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthly_hiring}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    name="Applications"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="interviews"
                    name="Interviews"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="offers"
                    name="Offers"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="hires"
                    name="Hires"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </PageTransition>
  )
}
