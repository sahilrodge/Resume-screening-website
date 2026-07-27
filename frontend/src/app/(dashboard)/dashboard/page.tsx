"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  BriefcaseBusiness,
  Building2,
  TrendingUp,
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
import { StatCard } from "@/components/shared/stat-card"
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
import { jobsApi } from "@/services/jobs"
import { notificationsApi } from "@/services/notifications"
import type { MonthlyHiringPoint } from "@/types/analytics"
import type { AppNotification } from "@/types/notification"
import type { JobDashboardStats } from "@/types/job"

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

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<JobDashboardStats | null>(null)
  const [pipeline, setPipeline] = useState<MonthlyHiringPoint[]>([])
  const [activity, setActivity] = useState<AppNotification[]>([])
  const reportHref = user?.role === "admin" ? "/reports" : "/analytics"

  useEffect(() => {
    void jobsApi
      .dashboardStats()
      .then(setStats)
      .catch(() => setStats(null))

    void analyticsApi
      .overview(6)
      .then((data) => setPipeline(data.monthly_hiring ?? []))
      .catch(() => setPipeline([]))

    void notificationsApi
      .list({ page: 1, page_size: 8 })
      .then((res) => setActivity(res.items ?? []))
      .catch(() => setActivity([]))
  }, [])

  const chartData = pipeline.map((point) => ({
    month: point.label,
    applications: point.applications,
    interviews: point.interviews,
    hires: point.hires,
  }))

  const cards = [
    {
      title: "Open jobs",
      value: stats ? String(stats.open_jobs) : "—",
      delta: stats ? `${stats.draft_jobs} draft` : "Loading…",
      trend: "up" as const,
      icon: BriefcaseBusiness,
    },
    {
      title: "Total jobs",
      value: stats ? String(stats.total_jobs) : "—",
      delta: stats
        ? `${stats.closed_jobs} closed · ${stats.filled_jobs} filled`
        : "Loading…",
      trend: "neutral" as const,
      icon: Building2,
    },
    {
      title: "Applications",
      value: stats ? String(stats.total_applications) : "—",
      delta: "Across all roles",
      trend: "up" as const,
      icon: Users,
    },
    {
      title: "Fill rate",
      value:
        stats && stats.total_jobs
          ? `${Math.round((stats.filled_jobs / stats.total_jobs) * 100)}%`
          : stats
            ? "0%"
            : "—",
      delta: "Filled / total jobs",
      trend: "up" as const,
      icon: TrendingUp,
    },
  ]

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Recruiter Dashboard"
          description="Monitor job status, applications, and hiring activity across HirePulse."
          actions={
            <>
              <Link href={reportHref} className={buttonVariants({ variant: "outline" })}>
                Download report
              </Link>
              <Link href="/jobs" className={buttonVariants()}>
                Create job
              </Link>
            </>
          }
        />
      </FadeIn>

      <FadeIn>
        <BackendStatus />
      </FadeIn>

      <FadeIn>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((stat) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              delta={stat.delta}
              trend={stat.trend}
              icon={stat.icon}
              className="transition-transform duration-300 hover:-translate-y-0.5"
            />
          ))}
        </div>
      </FadeIn>

      <div className="grid gap-4 xl:grid-cols-5">
        <FadeIn className="xl:col-span-3">
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Hiring pipeline</CardTitle>
              <CardDescription>
                Applications, interviews, and hires over the last 6 months
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No hiring data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="apps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
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
          <Card className="h-full border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Live activity</CardTitle>
              <CardDescription>Recent notifications and hiring alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity yet.</p>
              ) : (
                activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm">
                        <span className="font-medium">{item.title}</span>{" "}
                        <span className="text-muted-foreground">{item.message}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(item.created_at)}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {item.channel}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
