"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BriefcaseBusiness, ScanSearch, Bot } from "lucide-react"

import { useAuth } from "@/features/auth/auth-provider"
import { applicationsApi } from "@/services/applications"
import { candidatesApi } from "@/services/candidates"
import type { ApplicationMatch } from "@/types/application"
import type { Candidate } from "@/types/candidate"

export default function PortalHomePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Candidate | null>(null)
  const [applications, setApplications] = useState<ApplicationMatch[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      candidatesApi.me(),
      applicationsApi.mine({ page: 1, page_size: 5 }),
    ])
      .then(([me, apps]) => {
        if (cancelled) return
        setProfile(me)
        setApplications(apps.items)
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load your portal data.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Candidate dashboard</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Welcome{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Track screening results, browse jobs, and manage your profile.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-3">
        <Link
          href="/portal/screening"
          className="space-y-2 border-t border-border pt-4 transition-opacity hover:opacity-80"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <ScanSearch className="size-4" />
            Resume AI Screening
          </div>
          <p className="text-sm text-muted-foreground">
            {applications.length
              ? `${applications.length} recent match result${applications.length === 1 ? "" : "s"}`
              : "View AI match scores for your applications"}
          </p>
        </Link>
        <Link
          href="/portal/jobs"
          className="space-y-2 border-t border-border pt-4 transition-opacity hover:opacity-80"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <BriefcaseBusiness className="size-4" />
            Jobs
          </div>
          <p className="text-sm text-muted-foreground">
            Browse open roles and application status
          </p>
        </Link>
        <Link
          href="/portal/assistant"
          className="space-y-2 border-t border-border pt-4 transition-opacity hover:opacity-80"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bot className="size-4" />
            AI Assistant
          </div>
          <p className="text-sm text-muted-foreground">
            Ask questions about roles and next steps
          </p>
        </Link>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-medium">Profile snapshot</h2>
        <p className="text-sm text-muted-foreground">
          {profile?.headline ||
            profile?.current_title ||
            "Complete your profile in Settings."}
        </p>
        <p className="text-sm text-muted-foreground">
          {profile?.location || "Location not set"}
          {profile?.years_experience != null
            ? ` · ${profile.years_experience} yrs experience`
            : ""}
        </p>
        <Link
          href="/portal/profile"
          className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] hover:bg-muted"
        >
          Open profile
        </Link>
      </section>
    </div>
  )
}
