"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { candidatesApi } from "@/services/candidates"
import { notificationsApi } from "@/services/notifications"
import type { Candidate } from "@/types/candidate"
import type { NotificationPreferences } from "@/types/notification"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

export default function PortalSettingsPage() {
  const [profile, setProfile] = useState<Candidate | null>(null)
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([candidatesApi.me(), notificationsApi.getPreferences()])
      .then(([me, preferences]) => {
        if (cancelled) return
        setProfile(me)
        setPrefs(preferences)
        setError(null)
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load settings.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function savePrefs() {
    if (!prefs) return
    setSubmitting(true)
    setError(null)
    setSaved(null)
    try {
      const updated = await notificationsApi.updatePreferences({
        email_enabled: prefs.email_enabled,
        in_app_enabled: prefs.in_app_enabled,
        push_enabled: prefs.push_enabled,
      })
      setPrefs(updated)
      setSaved("Notification preferences saved.")
    } catch {
      setError("Failed to save preferences.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        {loading && !profile ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {profile?.full_name ?? "Candidate"} · {profile?.email ?? ""}
          </p>
        )}
        <Link href="/portal/profile" className={buttonVariants({ variant: "outline" })}>
          Edit profile
        </Link>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Notifications</h2>
        {loading && !prefs ? (
          <p className="text-sm text-muted-foreground">Loading preferences…</p>
        ) : null}
        {!loading && !prefs ? (
          <p className="text-sm text-muted-foreground">
            Preferences unavailable. Try refreshing the page.
          </p>
        ) : null}
        {prefs ? (
          <div className="space-y-3">
            {(
              [
                ["email_enabled", "Email"],
                ["in_app_enabled", "In-app"],
                ["push_enabled", "Push"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={prefs[key]}
                  onCheckedChange={(checked) =>
                    setPrefs({ ...prefs, [key]: Boolean(checked) })
                  }
                />
                {label}
              </label>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => void savePrefs()}
            >
              Save preferences
            </Button>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-muted-foreground">{saved}</p>
      ) : null}
    </div>
  )
}
