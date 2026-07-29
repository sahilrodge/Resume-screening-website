"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ComponentType } from "react"
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FileText,
  TrendingUp,
  UserRoundSearch,
  Users,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { BackendStatus } from "@/components/dashboard/backend-status"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/features/auth/auth-provider"
import { analyticsApi } from "@/services/analytics"
import { candidatesApi } from "@/services/candidates"
import { interviewsApi } from "@/services/interviews"
import { jobsApi } from "@/services/jobs"
import { notificationsApi } from "@/services/notifications"
import { resumesApi } from "@/services/resumes"
import { usersApi } from "@/services/users"
import type { AnalyticsOverview } from "@/types/analytics"
import type { AppNotification } from "@/types/notification"
import type { JobDashboardStats } from "@/types/job"
import { cn } from "@/lib/utils"

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

function formatScore(value: number | null | undefined) {
  if (value == null) return "—"
  return value.toFixed(1)
}

function formatPct(value: number | null | undefined) {
  if (value == null) return "—"
  return `${Math.round(value * 100)}%`
}

type Metric = {
  title: string
  value: string
  hint: string
  href: string
  icon: ComponentType<{ className?: string }>
}

function MetricLink({ item }: { item: Metric }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="group flex min-h-[5.75rem] flex-col justify-between rounded-xl border border-border/70 bg-card/80 p-3.5 transition-colors hover:border-border hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{item.title}</p>
        <span className="rounded-md bg-primary/10 p-1.5 text-primary">
          <Icon className="size-3.5" />
        </span>
      </div>
      <div>
        <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {item.value}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground group-hover:text-foreground/70">
          {item.hint}
        </p>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [stats, setStats] = useState<JobDashboardStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [activity, setActivity] = useState<AppNotification[]>([])
  const [usersTotal, setUsersTotal] = useState<number | null>(null)
  const [recruitersTotal, setRecruitersTotal] = useState<number | null>(null)
  const [candidatesTotal, setCandidatesTotal] = useState<number | null>(null)
  const [interviewsTotal, setInterviewsTotal] = useState<number | null>(null)
  const [resumesTotal, setResumesTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const reportHref = isAdmin ? "/reports" : "/analytics"

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      const [
        jobStats,
        overview,
        notifs,
        candidates,
        interviews,
        resumes,
        allUsers,
        recruiters,
      ] = await Promise.all([
        jobsApi.dashboardStats().catch(() => null),
        analyticsApi.overview(6).catch(() => null),
        notificationsApi.list({ page: 1, page_size: 8 }).catch(() => null),
        candidatesApi.list({ page: 1, page_size: 1 }).catch(() => null),
        interviewsApi.list({ page: 1, page_size: 1 }).catch(() => null),
        resumesApi.list({ page: 1, page_size: 1 }).catch(() => null),
        isAdmin
          ? usersApi.list({ page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null),
        isAdmin
          ? usersApi
              .list({ page: 1, page_size: 1, role: "recruiter" })
              .catch(() => null)
          : Promise.resolve(null),
      ])

      if (cancelled) return
      setStats(jobStats)
      setAnalytics(overview)
      setActivity(notifs?.items ?? [])
      setCandidatesTotal(candidates?.total ?? null)
      setInterviewsTotal(interviews?.total ?? null)
      setResumesTotal(resumes?.total ?? null)
      setUsersTotal(allUsers?.total ?? null)
      setRecruitersTotal(recruiters?.total ?? null)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const chartData = useMemo(
    () =>
      (analytics?.monthly_hiring ?? []).map((point) => ({
        month: point.label,
        applications: point.applications,
        interviews: point.interviews,
        hires: point.hires,
      })),
    [analytics]
  )

  const dash = (n: number | null | undefined) =>
    loading && n == null ? "…" : n == null ? "—" : String(n)

  const metrics: Metric[] = [
    ...(isAdmin
      ? [
          {
            title: "Users",
            value: dash(usersTotal),
            hint: "All platform accounts",
            href: "/users",
            icon: Users,
          },
          {
            title: "Recruiters",
            value: dash(recruitersTotal),
            hint: "Hiring team accounts",
            href: "/recruiters",
            icon: UserRoundSearch,
          },
        ]
      : []),
    {
      title: "Candidates",
      value: dash(candidatesTotal),
      hint: "In the talent pipeline",
      href: "/candidates",
      icon: Users,
    },
    {
      title: "Active jobs",
      value: dash(stats?.open_jobs),
      hint: stats ? `${stats.draft_jobs} draft · ${stats.total_jobs} total` : "Open roles",
      href: "/jobs",
      icon: BriefcaseBusiness,
    },
    {
      title: "Applications",
      value: dash(stats?.total_applications ?? analytics?.kpis.total_applications),
      hint: "Across all roles",
      href: "/screening",
      icon: Building2,
    },
    {
      title: "Interviews",
      value: dash(interviewsTotal),
      hint:
        analytics?.interview_results.by_status
          .map((s) => `${s.count} ${s.label.toLowerCase()}`)
          .slice(0, 2)
          .join(" · ") || "Scheduled & completed",
      href: "/interviews",
      icon: CalendarDays,
    },
    {
      title: "Analytics",
      value:
        analytics?.kpis.avg_match_score != null
          ? formatScore(analytics.kpis.avg_match_score)
          : loading
            ? "…"
            : "—",
      hint: `Avg match · ${formatPct(analytics?.kpis.screen_to_interview_rate)} screen→interview`,
      href: "/analytics",
      icon: BarChart3,
    },
    {
      title: "Resume stats",
      value: dash(resumesTotal),
      hint:
        analytics?.match_scores.scored_applications != null
          ? `${analytics.match_scores.scored_applications} scored · ${analytics.match_scores.unscored_applications} pending`
          : "Uploaded candidate resumes",
      href: "/resumes",
      icon: FileText,
    },
  ]

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title={isAdmin ? "Admin Dashboard" : "Recruiter Dashboard"}
          description={
            isAdmin
              ? "Users, hiring pipeline, interviews, analytics, and resume health in one place."
              : "Jobs, candidates, applications, interviews, and hiring analytics."
          }
          actions={
            <>
              <Link
                href={reportHref}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {isAdmin ? "Reports" : "Analytics"}
              </Link>
              <Link href="/jobs" className={cn(buttonVariants({ size: "sm" }))}>
                Create job
              </Link>
            </>
          }
        />
      </FadeIn>

      <div className="space-y-4 md:space-y-5">
        <FadeIn>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
            <div
              className={cn(
                "grid gap-3",
                isAdmin ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"
              )}
            >
              {metrics.map((item) => (
                <MetricLink key={item.title} item={item} />
              ))}
            </div>
            <BackendStatus />
          </div>
        </FadeIn>

        {/* Analytics snapshot */}
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader className="flex flex-col gap-2 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <CardTitle className="font-heading text-base">Analytics</CardTitle>
                <CardDescription>
                  Hiring KPIs from the last 6 months
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="size-3" />
                  {analytics?.kpis.total_hires ?? "—"} hires
                </Badge>
                <Badge variant="outline">
                  TTH{" "}
                  {analytics?.kpis.avg_time_to_hire_days != null
                    ? `${analytics.kpis.avg_time_to_hire_days}d`
                    : "—"}
                </Badge>
                <Badge variant="outline">
                  Offer accept {formatPct(analytics?.kpis.offer_accept_rate)}
                </Badge>
                <Link
                  href="/analytics"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Open analytics
                </Link>
              </div>
            </CardHeader>
          </Card>
        </FadeIn>

        <div className="grid gap-4 xl:grid-cols-5">
          <FadeIn className="xl:col-span-3">
            <Card className="border-border/70 bg-card/80 shadow-none">
              <CardHeader className="p-4 sm:p-5">
                <CardTitle className="font-heading text-base">
                  Hiring pipeline
                </CardTitle>
                <CardDescription>
                  Applications, interviews, and hires over the last 6 months
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[240px] px-2 pb-4 sm:h-[280px] sm:px-4 sm:pb-5">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No hiring data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="apps" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="var(--chart-1)"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--chart-1)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={32} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--card)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="applications"
                        stroke="var(--chart-1)"
                        fill="url(#apps)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="interviews"
                        stroke="var(--chart-2)"
                        fill="transparent"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="hires"
                        stroke="var(--chart-3)"
                        fill="transparent"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn className="xl:col-span-2">
            <Card className="flex h-full flex-col border-border/70 bg-card/80 shadow-none">
              <CardHeader className="p-4 sm:p-5">
                <CardTitle className="font-heading text-base">
                  Live activity
                </CardTitle>
                <CardDescription>
                  Recent notifications and hiring alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent activity yet.
                  </p>
                ) : (
                  activity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {item.message}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatWhen(item.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {item.channel}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        {/* Resume statistics */}
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader className="flex flex-col gap-2 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <CardTitle className="font-heading text-base">
                  Resume Statistics
                </CardTitle>
                <CardDescription>
                  Uploaded resumes and AI scoring coverage
                </CardDescription>
              </div>
              <Link
                href="/resumes"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Manage resumes
              </Link>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-4 pt-0 sm:grid-cols-4 sm:p-5 sm:pt-0">
              <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
                <p className="text-xs text-muted-foreground">Total resumes</p>
                <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                  {dash(resumesTotal)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
                <p className="text-xs text-muted-foreground">Scored apps</p>
                <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                  {dash(analytics?.match_scores.scored_applications)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
                <p className="text-xs text-muted-foreground">Unscored apps</p>
                <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                  {dash(analytics?.match_scores.unscored_applications)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
                <p className="text-xs text-muted-foreground">Avg match score</p>
                <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                  {analytics?.match_scores.avg_score != null
                    ? formatScore(analytics.match_scores.avg_score)
                    : loading
                      ? "…"
                      : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
