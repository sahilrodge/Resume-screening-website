"use client"

import Link from "next/link"
import {
  ExternalLink,
  Globe,
  MapPin,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { HirePulseMark } from "@/components/brand/hirepulse-mark"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  formatEmploymentType,
  formatJobDate,
  formatJobSalary,
} from "@/features/jobs/format"
import type { CompanyProfile } from "@/types/company"
import { cn } from "@/lib/utils"

type CompanyProfileViewProps = {
  company: CompanyProfile
  jobHref: (jobId: string) => string
  backHref: string
  backLabel?: string
}

const SOCIAL_META: Record<string, { label: string; icon: LucideIcon }> = {
  linkedin: { label: "LinkedIn", icon: ExternalLink },
  twitter: { label: "X / Twitter", icon: Globe },
  facebook: { label: "Facebook", icon: Globe },
  instagram: { label: "Instagram", icon: Globe },
  youtube: { label: "YouTube", icon: ExternalLink },
  github: { label: "GitHub", icon: ExternalLink },
  website: { label: "Website", icon: Globe },
}

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

export function CompanyProfileView({
  company,
  jobHref,
  backHref,
  backLabel = "Back",
}: CompanyProfileViewProps) {
  const socialEntries = Object.entries(company.social_links ?? {}).filter(
    ([, value]) => Boolean(value)
  )
  const benefits = company.benefits ?? []
  const openJobs = company.open_jobs ?? []

  return (
    <div className="space-y-8">
      <Link
        href={backHref}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
      >
        {backLabel}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <HirePulseMark size="xl" />
        <div className="min-w-0 space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[company.industry, company.location].filter(Boolean).join(" · ") ||
              "Company profile"}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {company.employee_count ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                <Users className="size-3.5" />
                {company.employee_count} employees
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
              {company.open_jobs_count ?? openJobs.length} open jobs
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <MetaBlock label="Industry" value={company.industry || "—"} />
        <MetaBlock
          label="Headquarters"
          value={
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
              {company.location || "—"}
            </span>
          }
        />
        <MetaBlock
          label="Website"
          value={
            company.website ? (
              <a
                href={normalizeUrl(company.website)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                {company.website.replace(/^https?:\/\//i, "")}
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              "—"
            )
          }
        />
        <MetaBlock label="Employees" value={company.employee_count || "—"} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">About company</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {company.description || "No company description available."}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Company culture</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {company.culture || "No culture details listed yet."}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Benefits</h2>
        {benefits.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <li
                key={benefit}
                className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm"
              >
                {benefit}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No benefits listed yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Social links</h2>
        {socialEntries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {socialEntries.map(([key, value]) => {
              const meta = SOCIAL_META[key] ?? {
                label: key,
                icon: Globe,
              }
              const Icon = meta.icon
              return (
                <a
                  key={key}
                  href={normalizeUrl(String(value))}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5"
                  )}
                >
                  <Icon className="size-3.5" />
                  {meta.label}
                </a>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No social links listed.</p>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Open jobs</h2>
          <span className="text-xs text-muted-foreground">
            {openJobs.length} role{openJobs.length === 1 ? "" : "s"}
          </span>
        </div>
        {openJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open roles at this company right now.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border/70">
            {openJobs.map((job) => (
              <li
                key={job.id}
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {job.location ? `${job.location} · ` : ""}
                    {formatEmploymentType(job.employment_type)}
                    {` · ${formatJobSalary(job)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Posted {formatJobDate(job.published_at || job.created_at)}
                    {" · "}
                    Deadline {formatJobDate(job.closes_at)}
                  </p>
                  {job.skills && job.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {job.skills.slice(0, 5).map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Link
                  href={jobHref(job.id)}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  View job
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function MetaBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
