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
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { pipelineChart, recentActivity } from "@/data/admin-mock"
import { jobsApi } from "@/services/jobs"
import type { JobDashboardStats } from "@/types/job"

export default function DashboardPage() {
  const [stats, setStats] = useState<JobDashboardStats | null>(null)

  useEffect(() => {
    void jobsApi
      .dashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

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
              <Button variant="outline">Download report</Button>
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
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pipelineChart}>
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
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn className="xl:col-span-2">
          <Card className="h-full border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Live activity</CardTitle>
              <CardDescription>Recent admin and recruiter actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{item.actor}</span>{" "}
                      <span className="text-muted-foreground">{item.action}</span>{" "}
                      <span className="font-medium">{item.target}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    New
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
