"use client"

import { useMemo, type ComponentType } from "react"
import Link from "next/link"
import {
  Bookmark,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ScanSearch,
  UserRound,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/admin/status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/features/auth/auth-provider"
import { useCandidateSync } from "@/features/candidate/candidate-sync-provider"
import { APPLICATION_STATUS_LABELS } from "@/types/application"
import { cn } from "@/lib/utils"

function initials(name?: string | null) {
  if (!name) return "HP"
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatWhen(iso?: string | null) {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function MetricTile({
  label,
  value,
  hint,
  href,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  href: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-border/70 bg-card/80 p-3.5 transition-colors hover:border-border hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="rounded-md bg-primary/10 p-1.5 text-primary">
          <Icon className="size-3.5" />
        </span>
      </div>
      <div>
        <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground group-hover:text-foreground/70">
          {hint}
        </p>
      </div>
    </Link>
  )
}

export default function PortalHomePage() {
  const { user } = useAuth()
  const {
    profile,
    applications,
    applicationsTotal,
    savedJobs,
    savedJobsTotal,
    interviews,
    interviewsTotal,
    hasResume,
    error,
    loading,
  } = useCandidateSync()

  const firstName = user?.full_name?.split(" ")[0] ?? profile?.full_name?.split(" ")[0]

  const resumeScore = useMemo(() => {
    const withMatch = applications.filter((a) => a.match_score != null)
    const withAts = applications.filter((a) => a.ats_score != null)
    const avgMatch = withMatch.length
      ? Math.round(
          withMatch.reduce((sum, a) => sum + (a.match_score ?? 0), 0) /
            withMatch.length
        )
      : null
    const avgAts = withAts.length
      ? Math.round(
          withAts.reduce((sum, a) => sum + (a.ats_score ?? 0), 0) / withAts.length
        )
      : null
    return { avgMatch, avgAts, scored: withMatch.length + withAts.length }
  }, [applications])

  const interviewBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of interviews) {
      counts[item.status] = (counts[item.status] ?? 0) + 1
    }
    return counts
  }, [interviews])

  const scoreDisplay =
    resumeScore.avgMatch != null
      ? `${resumeScore.avgMatch}%`
      : resumeScore.avgAts != null
        ? `${resumeScore.avgAts}%`
        : "—"

  return (
    <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Candidate dashboard
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Welcome{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your profile, applications, and interviews — synced live.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/portal/jobs"
            className={cn(buttonVariants({ size: "sm" }), "flex-1 sm:flex-none")}
          >
            Browse jobs
          </Link>
          <Link
            href="/portal/assistant"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "flex-1 gap-1.5 sm:flex-none"
            )}
          >
            <Bot className="size-3.5" />
            Assistant
          </Link>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Profile summary */}
      <Card className="border-border/70 bg-card/80 shadow-none">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3.5">
            <Avatar className="size-14 shrink-0 ring-1 ring-border/70">
              {profile?.avatar_url || user?.avatar_url ? (
                <AvatarImage
                  src={profile?.avatar_url || user?.avatar_url || undefined}
                  alt={profile?.full_name || user?.full_name || "Profile"}
                />
              ) : null}
              <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
                {initials(profile?.full_name || user?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-heading text-lg font-semibold">
                  {profile?.full_name || user?.full_name || "Your profile"}
                </h2>
                {hasResume ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Resume on file
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Resume needed
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {profile?.headline ||
                  profile?.current_title ||
                  "Add a headline to improve matches"}
              </p>
              <p className="text-xs text-muted-foreground">
                {profile?.location || "Location not set"}
                {profile?.years_experience != null
                  ? ` · ${profile.years_experience} yrs experience`
                  : ""}
                {profile?.skills?.length
                  ? ` · ${profile.skills.length} skills`
                  : ""}
              </p>
            </div>
          </div>
          <Link
            href="/portal/profile"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-full shrink-0 gap-1.5 sm:w-auto"
            )}
          >
            <UserRound className="size-3.5" />
            View profile
          </Link>
        </CardContent>
      </Card>

      {/* Key metrics */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile
          label="Resume score"
          value={loading ? "…" : scoreDisplay}
          hint={
            resumeScore.avgAts != null
              ? `ATS avg ${resumeScore.avgAts}%`
              : "From screening matches"
          }
          href="/portal/screening"
          icon={ScanSearch}
        />
        <MetricTile
          label="Saved jobs"
          value={loading ? "…" : String(savedJobsTotal)}
          hint="Bookmarked roles"
          href="/portal/saved-jobs"
          icon={Bookmark}
        />
        <MetricTile
          label="Applied jobs"
          value={loading ? "…" : String(applicationsTotal)}
          hint="Active applications"
          href="/portal/jobs"
          icon={BriefcaseBusiness}
        />
        <MetricTile
          label="Interviews"
          value={loading ? "…" : String(interviewsTotal)}
          hint={
            interviewBreakdown.scheduled
              ? `${interviewBreakdown.scheduled} scheduled`
              : "Interview status"
          }
          href="/portal/profile"
          icon={CalendarDays}
        />
      </section>

      {/* Resume score detail */}
      <Card className="border-border/70 bg-card/80 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2 sm:p-5 sm:pb-3">
          <div>
            <CardTitle className="font-heading text-base">Resume Score</CardTitle>
            <CardDescription>
              Average AI match and ATS scores across your applications
            </CardDescription>
          </div>
          <Link
            href="/portal/screening"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Screening
          </Link>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 sm:grid-cols-2 sm:p-5 sm:pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Match score</span>
              <span className="font-medium tabular-nums">
                {resumeScore.avgMatch != null ? `${resumeScore.avgMatch}%` : "—"}
              </span>
            </div>
            <Progress value={resumeScore.avgMatch ?? 0} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ATS score</span>
              <span className="font-medium tabular-nums">
                {resumeScore.avgAts != null ? `${resumeScore.avgAts}%` : "—"}
              </span>
            </div>
            <Progress value={resumeScore.avgAts ?? 0} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Saved jobs */}
        <Card className="border-border/70 bg-card/80 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5 sm:pb-3">
            <div>
              <CardTitle className="font-heading text-base">Saved Jobs</CardTitle>
              <CardDescription>{savedJobsTotal} bookmarked</CardDescription>
            </div>
            <Link
              href="/portal/saved-jobs"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {savedJobs.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-5">
                No saved jobs yet.{" "}
                <Link href="/portal/jobs" className="text-primary underline">
                  Browse roles
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {savedJobs.slice(0, 5).map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/portal/jobs/${job.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{job.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {job.company_name ?? "Company"}
                          {job.location ? ` · ${job.location}` : ""}
                        </p>
                      </div>
                      <Bookmark className="size-3.5 shrink-0 text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Applied jobs */}
        <Card className="border-border/70 bg-card/80 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5 sm:pb-3">
            <div>
              <CardTitle className="font-heading text-base">Applied Jobs</CardTitle>
              <CardDescription>{applicationsTotal} applications</CardDescription>
            </div>
            <Link
              href="/portal/jobs"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {applications.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-5">
                No applications yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {applications.slice(0, 5).map((app) => (
                  <li
                    key={app.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {app.job_title ?? "Role"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {app.company_name ?? "Company"}
                        {app.match_score != null
                          ? ` · Match ${Math.round(app.match_score)}%`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {APPLICATION_STATUS_LABELS[app.status] ?? app.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Interview status */}
        <Card className="border-border/70 bg-card/80 shadow-none">
          <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="font-heading text-base">Interview Status</CardTitle>
            <CardDescription>
              {interviewsTotal} interview{interviewsTotal === 1 ? "" : "s"} total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
            {interviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No interviews scheduled yet.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(interviewBreakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <StatusBadge status={status} />
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border/60">
                  {interviews.slice(0, 4).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.job_title ?? "Interview"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.company_name ?? "Company"} · {formatWhen(item.scheduled_at)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
