"use client"

import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useCandidateSync } from "@/features/candidate/candidate-sync-provider"
import { APPLICATION_STATUS_LABELS } from "@/types/application"
import { formatEmploymentType, formatJobDate } from "@/features/jobs/format"
import { cn } from "@/lib/utils"

function formatWhen(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function CandidateLoginInfoSection() {
  const { profile } = useCandidateSync()
  if (!profile) return null

  return (
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardHeader>
        <CardTitle className="font-heading text-base">Login Information</CardTitle>
        <CardDescription>
          Account identity synced from the database. Password changes live in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="font-medium">{profile.email}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Role</p>
          <p className="font-medium capitalize">{profile.role}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Account status</p>
          <p className="font-medium">{profile.is_active ? "Active" : "Inactive"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Member since</p>
          <p className="font-medium">{formatJobDate(profile.created_at)}</p>
        </div>
        <div className="sm:col-span-2">
          <Link
            href="/portal/settings"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Manage login & password
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export function CandidateActivitySections() {
  const {
    applications,
    applicationsTotal,
    savedJobs,
    savedJobsTotal,
    interviews,
    interviewsTotal,
    notifications,
    unreadCount,
    refreshing,
  } = useCandidateSync()

  const screening = applications.filter(
    (app) => app.match_score != null || app.ats_score != null || app.summary
  )

  return (
    <div className="space-y-4">
      {refreshing ? (
        <p className="text-xs text-muted-foreground">Refreshing latest data…</p>
      ) : null}

      <Card className="border-border/70 bg-card/80 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base">Saved Jobs</CardTitle>
            <CardDescription>
              {savedJobsTotal} saved · synced from your bookmarks
            </CardDescription>
          </div>
          <Link
            href="/portal/saved-jobs"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {savedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved jobs yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {savedJobs.slice(0, 5).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/portal/jobs/${job.id}`}
                      className="truncate font-medium underline-offset-4 hover:underline"
                    >
                      {job.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {job.company_name ?? "Company"}
                      {job.location ? ` · ${job.location}` : ""}
                      {` · ${formatEmploymentType(job.employment_type)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base">Applied Jobs</CardTitle>
            <CardDescription>
              {applicationsTotal} application{applicationsTotal === 1 ? "" : "s"}
            </CardDescription>
          </div>
          <Link
            href="/portal/jobs"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {applications.slice(0, 5).map((app) => (
                <li
                  key={app.id}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{app.job_title ?? "Role"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.company_name ?? "Company"} · Applied{" "}
                      {formatJobDate(app.created_at)}
                    </p>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">
                    {APPLICATION_STATUS_LABELS[app.status] ?? app.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base">
              Resume Screening History
            </CardTitle>
            <CardDescription>
              AI match / ATS results from your applications
            </CardDescription>
          </div>
          <Link
            href="/portal/screening"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Open screening
          </Link>
        </CardHeader>
        <CardContent>
          {screening.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No screening results yet. Apply to a job to generate a match report.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {screening.slice(0, 5).map((app) => (
                <li key={app.id} className="space-y-1 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{app.job_title ?? "Role"}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.scoring_engine === "openai"
                        ? "AI Score · "
                        : app.scoring_engine === "local"
                          ? "Local Analysis · "
                          : ""}
                      {app.match_score != null
                        ? `Match ${Math.round(app.match_score)}%`
                        : ""}
                      {app.ats_score != null
                        ? `${app.match_score != null ? " · " : ""}ATS ${Math.round(app.ats_score)}%`
                        : ""}
                    </p>
                  </div>
                  {app.summary ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {app.summary}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-none">
        <CardHeader>
          <CardTitle className="font-heading text-base">Interview History</CardTitle>
          <CardDescription>
            {interviewsTotal} interview{interviewsTotal === 1 ? "" : "s"} scheduled
          </CardDescription>
        </CardHeader>
        <CardContent>
          {interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interviews scheduled yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {interviews.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.job_title ?? "Interview"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.company_name ?? "Company"} · {formatWhen(item.scheduled_at)} ·{" "}
                      {item.interview_type.replaceAll("_", " ")}
                    </p>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">
                    {item.status.replaceAll("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base">Notifications</CardTitle>
            <CardDescription>
              {unreadCount} unread · latest alerts from HirePulse
            </CardDescription>
          </div>
          <Link
            href="/portal/notifications"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.slice(0, 5).map((item) => (
                <li key={item.id} className="space-y-1 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatWhen(item.created_at)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {item.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
