"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Briefcase, FolderKanban, GraduationCap, Mail, Phone, Sparkles } from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiLoading } from "@/hooks/use-api-loading"
import { candidatesApi } from "@/services/candidates"
import { ApiError } from "@/types/api"
import type { CandidateProfile } from "@/types/candidate"

export default function CandidateProfilePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const apiLoading = useApiLoading()
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await candidatesApi.getProfile(id)
      setProfile(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load profile")
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const parsed = profile?.parsed_data
  const skills = parsed?.skills?.length ? parsed.skills : profile?.skills ?? []

  return (
    <PageTransition>
      <PageHeader
        title={profile?.full_name ?? "Candidate profile"}
        description={
          profile?.headline ||
          profile?.current_title ||
          "Parsed resume details and contact information"
        }
        actions={
          <div className="flex gap-2">
            <Link
              href="/candidates"
              className={buttonVariants({ variant: "outline" })}
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
            <Button variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!profile && apiLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {profile ? (
        <div className="space-y-8">
          <FadeIn>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={profile.is_active ? "Active" : "Inactive"} />
                {profile.resume_status ? (
                  <StatusBadge status={profile.resume_status} />
                ) : (
                  <span className="text-xs text-muted-foreground">No parsed resume yet</span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
                  <p className="font-medium">{parsed?.name || profile.full_name}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="mt-1 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                    <p className="font-medium">{parsed?.email || profile.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="mt-1 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                    <p className="font-medium">{parsed?.phone || profile.phone || "—"}</p>
                  </div>
                </div>
              </div>
            </section>
          </FadeIn>

          <Separator />

          <FadeIn>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <h2 className="font-heading text-lg font-semibold">Skills</h2>
              </div>
              {skills.length ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No skills extracted yet.</p>
              )}
            </section>
          </FadeIn>

          <FadeIn>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="size-4 text-muted-foreground" />
                <h2 className="font-heading text-lg font-semibold">Experience</h2>
              </div>
              {parsed?.experience?.length ? (
                <ul className="space-y-4">
                  {parsed.experience.map((item, idx) => (
                    <li key={`${item.company}-${item.title}-${idx}`} className="space-y-1">
                      <p className="font-medium">
                        {item.title || "Role"}
                        {item.company ? ` · ${item.company}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[item.start_date, item.end_date].filter(Boolean).join(" – ") || "Dates n/a"}
                      </p>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No experience extracted yet.</p>
              )}
            </section>
          </FadeIn>

          <FadeIn>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-muted-foreground" />
                <h2 className="font-heading text-lg font-semibold">Education</h2>
              </div>
              {parsed?.education?.length ? (
                <ul className="space-y-4">
                  {parsed.education.map((item, idx) => (
                    <li key={`${item.institution}-${idx}`} className="space-y-1">
                      <p className="font-medium">
                        {item.degree || "Degree"}
                        {item.field ? ` in ${item.field}` : ""}
                      </p>
                      <p className="text-sm">{item.institution || "Institution n/a"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[item.start_date, item.end_date].filter(Boolean).join(" – ") || "Dates n/a"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No education extracted yet.</p>
              )}
            </section>
          </FadeIn>

          <FadeIn>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderKanban className="size-4 text-muted-foreground" />
                <h2 className="font-heading text-lg font-semibold">Projects</h2>
              </div>
              {parsed?.projects?.length ? (
                <ul className="space-y-4">
                  {parsed.projects.map((item, idx) => (
                    <li key={`${item.name}-${idx}`} className="space-y-1">
                      <p className="font-medium">{item.name || "Project"}</p>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                      {item.technologies?.length ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {item.technologies.map((tech) => (
                            <Badge key={tech} variant="outline">
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No projects extracted yet.</p>
              )}
            </section>
          </FadeIn>
        </div>
      ) : null}
    </PageTransition>
  )
}
