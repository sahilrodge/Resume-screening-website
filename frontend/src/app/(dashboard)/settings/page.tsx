"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { notificationsApi } from "@/services/notifications"
import type { NotificationPreferences } from "@/types/notification"
import { urlBase64ToUint8Array } from "@/lib/push"

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void notificationsApi
      .getPreferences()
      .then((data) => {
        if (!cancelled) {
          setPrefs(data)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load notification preferences.")
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
    setSaving(true)
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
      setSaving(false)
    }
  }

  async function enablePush() {
    if (!prefs?.vapid_public_key) {
      setPushMsg("Set VAPID keys in the backend .env first.")
      return
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushMsg("Push is not supported in this browser.")
      return
    }
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setPushMsg("Notification permission denied.")
        return
      }
      const reg = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          prefs.vapid_public_key
        ) as BufferSource,
      })
      const json = sub.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setPushMsg("Could not read push subscription keys.")
        return
      }
      await notificationsApi.subscribePush({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      })
      const updated = await notificationsApi.updatePreferences({
        push_enabled: true,
      })
      setPrefs(updated)
      setPushMsg("Push notifications enabled for this browser.")
    } catch {
      setPushMsg("Failed to enable push notifications.")
    }
  }

  const channels = prefs
    ? [
        {
          key: "email_enabled" as const,
          label: "Email",
          note: prefs.smtp_configured
            ? "SMTP configured"
            : "SMTP not configured (logged only)",
        },
        {
          key: "in_app_enabled" as const,
          label: "In-app",
          note: "Bell inbox & history",
        },
        {
          key: "push_enabled" as const,
          label: "Push",
          note: prefs.push_configured
            ? "VAPID configured"
            : "VAPID keys missing",
        },
      ]
    : []

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Settings"
          description="Notification channels and delivery preferences."
          actions={
            <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
              Edit profile
            </Link>
          }
        />
      </FadeIn>

      {error ? (
        <FadeIn>
          <Card className="border-destructive/40 bg-destructive/5 shadow-none">
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        </FadeIn>
      ) : null}
      {saved ? (
        <p className="mb-4 text-sm text-muted-foreground">{saved}</p>
      ) : null}

      <FadeIn>
        <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
          <CardHeader>
            <CardTitle className="font-heading">Notification channels</CardTitle>
            <CardDescription>Choose how HirePulse reaches you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && !prefs ? (
              <p className="text-sm text-muted-foreground">Loading preferences…</p>
            ) : null}
            {!loading && !prefs && error ? (
              <p className="text-sm text-muted-foreground">
                Preferences unavailable. Retry after fixing the error above.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              {channels.map((channel) => (
                <label
                  key={channel.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <Checkbox
                    checked={Boolean(prefs?.[channel.key])}
                    onCheckedChange={(checked) =>
                      setPrefs((prev) =>
                        prev
                          ? { ...prev, [channel.key]: checked === true }
                          : prev
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <div className="font-medium">{channel.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {channel.note}
                    </div>
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void savePrefs()} disabled={!prefs || saving}>
                {saving ? "Saving…" : "Save preferences"}
              </Button>
              <Button variant="outline" onClick={() => void enablePush()}>
                Enable browser push
              </Button>
              {pushMsg ? (
                <span className="text-xs text-muted-foreground">{pushMsg}</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </PageTransition>
  )
}
