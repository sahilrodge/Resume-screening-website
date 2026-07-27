"use client"

import { useEffect, useState } from "react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { notificationsApi } from "@/services/notifications"
import type { NotificationPreferences } from "@/types/notification"
import { urlBase64ToUint8Array } from "@/lib/push"

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void notificationsApi
      .getPreferences()
      .then(setPrefs)
      .catch(() => setError("Could not load notification preferences."))
  }, [])

  async function savePrefs() {
    if (!prefs) return
    setSaving(true)
    try {
      const updated = await notificationsApi.updatePreferences({
        email_enabled: prefs.email_enabled,
        whatsapp_enabled: prefs.whatsapp_enabled,
        in_app_enabled: prefs.in_app_enabled,
        push_enabled: prefs.push_enabled,
      })
      setPrefs(updated)
      setError(null)
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
        applicationServerKey: urlBase64ToUint8Array(prefs.vapid_public_key),
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
      const updated = await notificationsApi.updatePreferences({ push_enabled: true })
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
          key: "whatsapp_enabled" as const,
          label: "WhatsApp",
          note: "Candidate alerts via Twilio",
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
          description="Workspace branding, access defaults, and notification preferences."
          actions={
            <Button onClick={() => void savePrefs()} disabled={!prefs || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Workspace</CardTitle>
              <CardDescription>Public admin console details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org">Organization name</Label>
                <Input id="org" defaultValue="HirePulse Admin" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support">Support email</Label>
                <Input id="support" type="email" defaultValue="admin@hirepulse.io" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Default timezone</Label>
                <Input id="timezone" defaultValue="Asia/Kolkata (IST)" />
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Access defaults</CardTitle>
              <CardDescription>Applied when inviting new users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Default role</Label>
                <Input id="role" defaultValue="recruiter" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session">Session length (minutes)</Label>
                <Input id="session" type="number" defaultValue={30} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfa">MFA policy</Label>
                <Input id="mfa" defaultValue="Recommended for admins" />
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn className="xl:col-span-2">
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading">Notification channels</CardTitle>
              <CardDescription>
                Choose how HirePulse reaches you. History is always stored under Notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                      <div className="text-xs text-muted-foreground">{channel.note}</div>
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
      </div>
    </PageTransition>
  )
}
