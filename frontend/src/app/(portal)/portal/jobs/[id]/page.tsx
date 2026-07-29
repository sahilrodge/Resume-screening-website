"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  CalendarClock,
  MapPin,
  Wallet,
} from "lucide-react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatEmploymentType,
  formatJobDate,
  formatJobExperience,
  formatJobSalary,
  isJobDeadlinePassed,
} from "@/features/jobs/format"
import { applicationsApi } from "@/services/applications"
import { jobsApi } from "@/services/jobs"
import { resumesApi } from "@/services/resumes"
import { ApiError } from "@/types/api"
import type { Job } from "@/types/job"
import { cn } from "@/lib/utils"

export default function PortalJobDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const jobId = params.id

  const [job, setJob] = useState<Job | null>(null)
  const [hasResume, setHasResume] = useState(false)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const load = useCallback(async () => {
    const [jobData, apps, resumes, savedIds] = await Promise.all([
      jobsApi.get(jobId),
      applicationsApi.mine({ page: 1, page_size: 100 }),
      resumesApi.listMine({ page: 1, page_size: 1 }),
      jobsApi.savedIds().catch(() => ({ job_ids: [] as string[] })),
    ])
    setJob(jobData)
    setAlreadyApplied(apps.items.some((a) => a.job_id === jobId))
    setHasResume(resumes.total > 0 || resumes.items.length > 0)
    setSaved(savedIds.job_ids.includes(jobId))
  }, [jobId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .then(() => {
        if (!cancelled) setError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load job.")
          setJob(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  async function apply() {
    if (!job) return
    if (!hasResume) {
      setError("Upload a resume on your profile before applying.")
      return
    }
    if (isJobDeadlinePassed(job.closes_at)) {
      setError("The application deadline for this job has passed.")
      return
    }
    setApplying(true)
    setError(null)
    try {
      await applicationsApi.apply({ job_id: job.id })
      setAlreadyApplied(true)
      setConfirmOpen(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply.")
    } finally {
      setApplying(false)
    }
  }

  async function toggleSave() {
    if (!job) return
    setSaving(true)
    setError(null)
    try {
      if (saved) {
        await jobsApi.unsave(job.id)
        setSaved(false)
      } else {
        await jobsApi.save(job.id)
        setSaved(true)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update saved job.")
    } finally {
      setSaving(false)
    }
  }

  const deadlinePassed = isJobDeadlinePassed(job?.closes_at)
  const applyDisabled =
    alreadyApplied || applying || !hasResume || deadlinePassed || !job

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/portal/jobs"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
          >
            <ArrowLeft className="size-4" />
            All jobs
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {!loading && job ? (
          <FadeIn className="space-y-6">
            <header className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <Link
                    href={`/portal/companies/${job.company_id}`}
                    className="shrink-0"
                  >
                    {job.company_logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={job.company_logo_url}
                        alt=""
                        className="mt-1 size-12 rounded-md border border-border bg-background object-contain p-1"
                      />
                    ) : (
                      <div className="mt-1 flex size-12 items-center justify-center rounded-md border border-border bg-muted/40">
                        <Building2 className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </Link>
                  <div className="space-y-1">
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">
                      {job.title}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      <Link
                        href={`/portal/companies/${job.company_id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {job.company_name ?? "Company"}
                      </Link>
                      {job.location ? ` · ${job.location}` : ""}
                      {` · ${formatEmploymentType(job.employment_type)}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => void toggleSave()}
                    className="gap-1.5"
                  >
                    {saved ? (
                      <BookmarkCheck className="size-4" />
                    ) : (
                      <Bookmark className="size-4" />
                    )}
                    {saved ? "Saved" : "Save Job"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={applyDisabled}
                    onClick={() => void apply()}
                  >
                    {alreadyApplied
                      ? "Applied"
                      : deadlinePassed
                        ? "Deadline passed"
                        : !hasResume
                          ? "Resume required"
                          : applying
                            ? "Applying…"
                            : "Apply"}
                  </Button>
                </div>
              </div>

              {!hasResume ? (
                <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  Upload a resume before you can apply.{" "}
                  <Link
                    href="/portal/profile"
                    className="font-medium text-primary underline"
                  >
                    Go to profile
                  </Link>
                </p>
              ) : null}
            </header>

            <section className="grid gap-3 sm:grid-cols-2">
              <MetaItem
                icon={<Wallet className="size-4" />}
                label="Salary"
                value={formatJobSalary(job)}
              />
              <MetaItem
                icon={<Briefcase className="size-4" />}
                label="Experience"
                value={formatJobExperience(job)}
              />
              <MetaItem
                icon={<MapPin className="size-4" />}
                label="Location"
                value={job.location || "Not specified"}
              />
              <MetaItem
                icon={<CalendarClock className="size-4" />}
                label="Posted"
                value={formatJobDate(job.published_at || job.created_at)}
              />
              <MetaItem
                icon={<CalendarClock className="size-4" />}
                label="Deadline"
                value={formatJobDate(job.closes_at)}
              />
              <MetaItem
                icon={<Building2 className="size-4" />}
                label="Company profile"
                value={
                  <Link
                    href={`/portal/companies/${job.company_id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View company
                  </Link>
                }
              />
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-sm font-medium">Skills</h2>
              {job.skills && job.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No skills listed.</p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium">Job description</h2>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {job.description}
              </div>
            </section>
          </FadeIn>
        ) : null}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Application submitted</DialogTitle>
              <DialogDescription>
                Your application for {job?.title ?? "this role"} was sent to the
                recruiter. You can track status under Your applications.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmOpen(false)
                  router.push("/portal/jobs")
                }}
              >
                Back to jobs
              </Button>
              <Button type="button" onClick={() => setConfirmOpen(false)}>
                Stay on this page
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
