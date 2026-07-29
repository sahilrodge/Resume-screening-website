"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { LogOut, Trash2 } from "lucide-react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { CardSkeleton } from "@/components/shared/page-skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/features/auth/auth-provider"
import { urlBase64ToUint8Array } from "@/lib/push"
import { authService } from "@/services/auth"
import { notificationsApi } from "@/services/notifications"
import { profileApi } from "@/services/profile"
import { settingsApi } from "@/services/settings"
import { ApiError } from "@/types/api"
import type { NotificationPreferences } from "@/types/notification"
import type { Profile } from "@/types/profile"
import type { SupportedLanguage, UserSettings } from "@/types/settings"

const LANGUAGES: { value: SupportedLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
]

type SettingsPageClientProps = {
  profileHref: string
  showPushControls?: boolean
}

export function SettingsPageClient({
  profileHref,
  showPushControls = false,
}: SettingsPageClientProps) {
  const { user, logout, refreshUser } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [appSettings, setAppSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [deletePassword, setDeletePassword] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingCareer, setSavingCareer] = useState(false)
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [preferredJobRole, setPreferredJobRole] = useState("")
  const [preferredLocation, setPreferredLocation] = useState("")
  const [expectedSalary, setExpectedSalary] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [portfolioUrl, setPortfolioUrl] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      profileApi.me(),
      notificationsApi.getPreferences(),
      settingsApi.me(),
    ])
      .then(([me, notificationPrefs, settings]) => {
        if (cancelled) return
        setProfile(me)
        setEmail(me.email)
        setPreferredJobRole(me.preferred_job_role ?? "")
        setPreferredLocation(me.preferred_location ?? "")
        setExpectedSalary(
          me.expected_salary == null || me.expected_salary === ""
            ? ""
            : String(me.expected_salary)
        )
        setDateOfBirth(me.date_of_birth ?? "")
        setPortfolioUrl(me.portfolio_url ?? "")
        setPrefs(notificationPrefs)
        setAppSettings(settings)
        document.documentElement.lang = settings.language
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load settings."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function flash(message: string) {
    setSaved(message)
    setError(null)
    window.setTimeout(() => setSaved(null), 4000)
  }

  async function saveEmail() {
    const next = email.trim().toLowerCase()
    if (!next || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setError("Enter a valid email address.")
      return
    }
    setSavingEmail(true)
    setError(null)
    try {
      const updated = await profileApi.update({ email: next })
      setProfile(updated)
      setEmail(updated.email)
      await refreshUser()
      flash("Email updated successfully.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update email.")
    } finally {
      setSavingEmail(false)
    }
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.")
      return
    }
    if (!currentPassword) {
      setError("Current password is required.")
      return
    }
    setSavingPassword(true)
    setError(null)
    try {
      await profileApi.update({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      flash("Password changed successfully.")
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to change password."
      )
    } finally {
      setSavingPassword(false)
    }
  }

  async function saveCareerPrefs() {
    if (portfolioUrl.trim()) {
      try {
        const parsed = new URL(portfolioUrl.trim())
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setError("Portfolio URL must start with http:// or https://")
          return
        }
      } catch {
        setError("Portfolio URL must be a valid URL")
        return
      }
    }
    if (expectedSalary.trim()) {
      const salary = Number(expectedSalary)
      if (Number.isNaN(salary) || salary < 0) {
        setError("Expected salary must be a non-negative number")
        return
      }
    }
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth)
      const today = new Date()
      if (Number.isNaN(dob.getTime())) {
        setError("Enter a valid date of birth")
        return
      }
      if (dob > today) {
        setError("Date of birth cannot be in the future")
        return
      }
    }

    setSavingCareer(true)
    setError(null)
    try {
      const updated = await profileApi.update({
        preferred_job_role: preferredJobRole.trim() || null,
        preferred_location: preferredLocation.trim() || null,
        expected_salary: expectedSalary.trim()
          ? Number(expectedSalary)
          : null,
        date_of_birth: dateOfBirth || null,
        portfolio_url: portfolioUrl.trim() || null,
      })
      setProfile(updated)
      setPreferredJobRole(updated.preferred_job_role ?? "")
      setPreferredLocation(updated.preferred_location ?? "")
      setExpectedSalary(
        updated.expected_salary == null || updated.expected_salary === ""
          ? ""
          : String(updated.expected_salary)
      )
      setDateOfBirth(updated.date_of_birth ?? "")
      setPortfolioUrl(updated.portfolio_url ?? "")
      flash("Career preferences saved.")
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to save career preferences."
      )
    } finally {
      setSavingCareer(false)
    }
  }

  async function saveNotifications() {
    if (!prefs) return
    setSavingNotifs(true)
    setError(null)
    try {
      const updated = await notificationsApi.updatePreferences({
        email_enabled: prefs.email_enabled,
        in_app_enabled: prefs.in_app_enabled,
        push_enabled: prefs.push_enabled,
      })
      setPrefs(updated)
      flash("Notification preferences saved.")
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to save notification preferences."
      )
    } finally {
      setSavingNotifs(false)
    }
  }

  async function saveAppSettings(patch: Partial<UserSettings>) {
    setSavingPrivacy(true)
    setError(null)
    try {
      const updated = await settingsApi.update(patch)
      setAppSettings(updated)
      if (patch.language) {
        document.documentElement.lang = patch.language
      }
      flash("Settings saved.")
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to save settings."
      )
    } finally {
      setSavingPrivacy(false)
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

  async function onLogout() {
    setLoggingOut(true)
    setError(null)
    try {
      await logout()
    } catch (err) {
      setLoggingOut(false)
      setError(err instanceof ApiError ? err.message : "Logout failed.")
    }
  }

  async function onDeleteAccount() {
    if (deleteConfirm !== "DELETE") {
      setError('Type DELETE to confirm account deletion.')
      return
    }
    if (!deletePassword) {
      setError("Enter your password to delete the account.")
      return
    }
    if (
      !window.confirm(
        "This permanently deletes your account and data. Continue?"
      )
    ) {
      return
    }
    setDeleting(true)
    setError(null)
    try {
      await authService.deleteAccount(deletePassword)
      window.location.replace("/login")
    } catch (err) {
      setDeleting(false)
      setError(
        err instanceof ApiError ? err.message : "Failed to delete account."
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  const themeValue = mounted ? theme ?? "system" : "system"

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Settings"
          description="Manage account security, notifications, appearance, and privacy."
          actions={
            <Link
              href={profileHref}
              className={buttonVariants({ variant: "outline" })}
            >
              Edit profile
            </Link>
          }
        />
      </FadeIn>

      <p className="mb-4 text-sm text-muted-foreground">
        {profile?.full_name ?? user?.full_name ?? "Account"} ·{" "}
        {profile?.email ?? user?.email ?? ""}
      </p>

      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {saved}
        </p>
      ) : null}

      <div className="space-y-4">
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-base">
                Update email
              </CardTitle>
              <CardDescription>
                Used for login and account notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="settings_email">Email</Label>
                <Input
                  id="settings_email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={savingEmail || email.trim() === (profile?.email ?? "")}
                onClick={() => void saveEmail()}
              >
                {savingEmail ? "Saving…" : "Save email"}
              </Button>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-base">
                Change password
              </CardTitle>
              <CardDescription>
                Choose a strong password with at least 8 characters
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="settings_current_password">Current</Label>
                <Input
                  id="settings_current_password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings_new_password">New</Label>
                <Input
                  id="settings_new_password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings_confirm_password">Confirm</Label>
                <Input
                  id="settings_confirm_password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Button
                  type="button"
                  disabled={savingPassword || !newPassword}
                  onClick={() => void savePassword()}
                >
                  {savingPassword ? "Updating…" : "Update password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {profile?.role === "candidate" ? (
          <FadeIn>
            <Card className="border-border/70 bg-card/80 shadow-none">
              <CardHeader>
                <CardTitle className="font-heading text-base">
                  Career preferences
                </CardTitle>
                <CardDescription>
                  Optional details kept out of the main Profile page
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pref_role">Preferred job role</Label>
                  <Input
                    id="pref_role"
                    value={preferredJobRole}
                    onChange={(e) => setPreferredJobRole(e.target.value)}
                    placeholder="Frontend Engineer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pref_location">Preferred location</Label>
                  <Input
                    id="pref_location"
                    value={preferredLocation}
                    onChange={(e) => setPreferredLocation(e.target.value)}
                    placeholder="Remote / Hyderabad"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pref_salary">Expected salary</Label>
                  <Input
                    id="pref_salary"
                    type="number"
                    min={0}
                    step="1000"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="1200000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pref_dob">Date of birth</Label>
                  <Input
                    id="pref_dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pref_portfolio">Portfolio URL</Label>
                  <Input
                    id="pref_portfolio"
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    disabled={savingCareer}
                    onClick={() => void saveCareerPrefs()}
                  >
                    {savingCareer ? "Saving…" : "Save career preferences"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-base">
                Notification preferences
              </CardTitle>
              <CardDescription>Choose how HirePulse reaches you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {prefs ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["email_enabled", "Email", prefs.smtp_configured ? "SMTP ready" : "SMTP not configured"],
                      ["in_app_enabled", "In-app", "Bell inbox & history"],
                      ["push_enabled", "Push", prefs.push_configured ? "VAPID ready" : "VAPID keys missing"],
                    ] as const
                  ).map(([key, label, note]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={prefs[key]}
                        onCheckedChange={(checked) =>
                          setPrefs({ ...prefs, [key]: Boolean(checked) })
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{note}</div>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Preferences unavailable.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={!prefs || savingNotifs}
                  onClick={() => void saveNotifications()}
                >
                  {savingNotifs ? "Saving…" : "Save notifications"}
                </Button>
                {showPushControls ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void enablePush()}
                  >
                    Enable browser push
                  </Button>
                ) : null}
                {pushMsg ? (
                  <span className="text-xs text-muted-foreground">{pushMsg}</span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <div className="grid gap-4 lg:grid-cols-2">
          <FadeIn>
            <Card className="border-border/70 bg-card/80 shadow-none">
              <CardHeader>
                <CardTitle className="font-heading text-base">Theme</CardTitle>
                <CardDescription>
                  Appearance for this device
                  {mounted && resolvedTheme
                    ? ` · currently ${resolvedTheme}`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={themeValue}
                  onValueChange={(value) => {
                    if (value) setTheme(value)
                    flash("Theme updated.")
                  }}
                  items={[
                    { value: "system", label: "System" },
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Select theme">
                      {(value) => {
                        if (value === "light") return "Light"
                        if (value === "dark") return "Dark"
                        if (value === "system") return "System"
                        return null
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system" label="System">
                      System
                    </SelectItem>
                    <SelectItem value="light" label="Light">
                      Light
                    </SelectItem>
                    <SelectItem value="dark" label="Dark">
                      Dark
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn>
            <Card className="border-border/70 bg-card/80 shadow-none">
              <CardHeader>
                <CardTitle className="font-heading text-base">Language</CardTitle>
                <CardDescription>
                  Preferred interface language
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={appSettings?.language ?? "en"}
                  onValueChange={(value) => {
                    if (!value) return
                    void saveAppSettings({
                      language: value as SupportedLanguage,
                    })
                  }}
                  items={LANGUAGES.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                >
                  <SelectTrigger
                    className="w-full sm:w-56"
                    disabled={savingPrivacy}
                  >
                    <SelectValue placeholder="Select language">
                      {(value) =>
                        LANGUAGES.find((item) => item.value === value)?.label ||
                        null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        label={item.label}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-base">
                Privacy settings
              </CardTitle>
              <CardDescription>
                Control visibility and data processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {appSettings ? (
                (
                  [
                    [
                      "profile_discoverable",
                      "Profile discoverable",
                      "Allow your profile to appear in recruiter search",
                    ],
                    [
                      "show_email_to_recruiters",
                      "Show email to recruiters",
                      "Reveal your email on applications and profile views",
                    ],
                    [
                      "allow_ai_processing",
                      "Allow AI processing",
                      "Use AI for resume screening and assistant features",
                    ],
                    [
                      "share_activity_status",
                      "Share activity status",
                      "Show recent activity signals where supported",
                    ],
                  ] as const
                ).map(([key, label, note]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={appSettings[key]}
                      disabled={savingPrivacy}
                      onCheckedChange={(checked) => {
                        const next = Boolean(checked)
                        setAppSettings({ ...appSettings, [key]: next })
                        void saveAppSettings({ [key]: next })
                      }}
                      className="mt-0.5"
                    />
                    <span>
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{note}</div>
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Privacy settings unavailable.
                </p>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-base">Session</CardTitle>
              <CardDescription>
                Sign out clears tokens, cookies, and returns you to login
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                disabled={loggingOut}
                onClick={() => void onLogout()}
              >
                <LogOut data-icon="inline-start" />
                {loggingOut ? "Signing out…" : "Log out"}
              </Button>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn>
          <Card className="border-destructive/40 bg-destructive/5 shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-base text-destructive">
                Delete account
              </CardTitle>
              <CardDescription>
                Permanently remove your account and associated data. This cannot
                be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delete_password">Password</Label>
                <Input
                  id="delete_password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete_confirm">Type DELETE to confirm</Label>
                <Input
                  id="delete_confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => void onDeleteAccount()}
                >
                  <Trash2 data-icon="inline-start" />
                  {deleting ? "Deleting…" : "Delete account"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
