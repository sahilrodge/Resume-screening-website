"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Camera } from "lucide-react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { CardSkeleton } from "@/components/shared/page-skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/features/auth/auth-provider"
import {
  buildUpdatePayload,
  draftFromProfile,
  draftsEqual,
  validateDraft,
  type ProfileDraft,
  type ProfileFieldErrors,
} from "@/features/profile/profile-form"
import { AboutMeSection } from "@/features/profile/about-me-section"
import { EducationSection } from "@/features/profile/education-section"
import { ExperienceSection } from "@/features/profile/experience-section"
import { LocationCascading } from "@/features/profile/location-cascading"
import { SkillsSection } from "@/features/profile/skills-section"
import { LatestResumePanel } from "@/features/resumes/latest-resume-panel"
import { authStorage } from "@/lib/auth-storage"
import { cn } from "@/lib/utils"
import { profileApi } from "@/services/profile"
import { ApiError } from "@/types/api"
import type { Profile } from "@/types/profile"

const AUTO_SAVE_MS = 1600
const SUCCESS_DISMISS_MS = 4000

function initials(name?: string | null) {
  if (!name) return "HP"
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

export function ProfilePageClient() {
  const { refreshUser } = useAuth()
  const searchParams = useSearchParams()
  const focusNameOnEdit = searchParams.get("edit") === "1"
  const [profile, setProfile] = useState<Profile | null>(null)
  const [baseline, setBaseline] = useState<ProfileDraft | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarProgress, setAvatarProgress] = useState(0)

  const saveLock = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipAutoSaveUntil = useRef(0)

  const isDirty = useMemo(() => {
    if (!draft || !baseline) return false
    return !draftsEqual(draft, baseline)
  }, [draft, baseline])

  const showStatus = useCallback((message: string, kind: "success" | "error" | "info") => {
    if (kind === "error") {
      setError(message)
      setSaved(null)
      return
    }
    if (kind === "success") {
      setSaved(message)
      setError(null)
      if (successTimer.current) clearTimeout(successTimer.current)
      successTimer.current = setTimeout(() => setSaved(null), SUCCESS_DISMISS_MS)
      return
    }
    setStatusHint(message)
  }, [])

  const hydrate = useCallback((data: Profile) => {
    const next = draftFromProfile(data)
    setProfile(data)
    setBaseline(next)
    setDraft(next)
    setFieldErrors({})
    skipAutoSaveUntil.current = Date.now() + 500
  }, [])

  const reloadProfile = useCallback(async () => {
    const data = await profileApi.me()
    hydrate(data)
    return data
  }, [hydrate])

  const syncAuthUser = useCallback(
    async (updated: Profile) => {
      await authStorage.setUser({
        id: updated.id,
        email: updated.email,
        full_name: updated.full_name,
        role: updated.role,
        is_active: updated.is_active,
        avatar_url: updated.avatar_url,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      })
      await refreshUser()
    },
    [refreshUser]
  )

  useEffect(() => {
    let cancelled = false
    profileApi
      .me()
      .then((data) => {
        if (!cancelled) hydrate(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load profile")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (successTimer.current) clearTimeout(successTimer.current)
    }
  }, [hydrate])

  useEffect(() => {
    if (!focusNameOnEdit || loading || !draft) return
    const timer = window.setTimeout(() => {
      const input = document.getElementById("full_name") as HTMLInputElement | null
      input?.focus()
      input?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [focusNameOnEdit, loading, draft])

  const patchDraft = useCallback(
    <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
      setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
      setFieldErrors((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key as keyof ProfileFieldErrors]
        return next
      })
      setError(null)
    },
    []
  )

  const persist = useCallback(
    async (opts?: { source?: "manual" | "auto" }) => {
      if (!profile || !draft || saveLock.current) return false
      const source = opts?.source ?? "manual"

      const errors = validateDraft(draft, profile.role)
      setFieldErrors(errors)
      if (Object.keys(errors).length > 0) {
        if (source === "manual") {
          setError("Please fix the highlighted fields before saving.")
        }
        return false
      }

      saveLock.current = true
      if (source === "auto") setAutoSaving(true)
      else setSaving(true)
      setError(null)
      setStatusHint(source === "auto" ? "Auto-saving…" : null)

      try {
        const payload = buildUpdatePayload(draft, profile.role)
        const updated = await profileApi.update(payload)
        hydrate(updated)
        await syncAuthUser(updated)
        showStatus(
          source === "auto" ? "Changes auto-saved." : "Profile saved successfully.",
          "success"
        )
        setStatusHint(null)
        return true
      } catch (err) {
        showStatus(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to save profile",
          "error"
        )
        setStatusHint(null)
        return false
      } finally {
        saveLock.current = false
        setSaving(false)
        setAutoSaving(false)
      }
    },
    [profile, draft, hydrate, syncAuthUser, showStatus]
  )

  useEffect(() => {
    if (!profile || !draft || !baseline) return
    if (Date.now() < skipAutoSaveUntil.current) return
    if (draftsEqual(draft, baseline)) {
      setStatusHint(null)
      return
    }

    const errors = validateDraft(draft, profile.role)
    if (Object.keys(errors).length > 0) {
      setStatusHint("Unsaved changes — fix validation to auto-save")
      return
    }

    setStatusHint("Unsaved changes")
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      void persist({ source: "auto" })
    }, AUTO_SAVE_MS)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [draft, baseline, profile, persist])

  async function onManualSave(event: React.FormEvent) {
    event.preventDefault()
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    await persist({ source: "manual" })
  }

  function cancelChanges() {
    if (!baseline) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    setDraft(baseline)
    setFieldErrors({})
    setError(null)
    setStatusHint(null)
  }

  async function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploadingAvatar(true)
    setAvatarProgress(0)
    try {
      const updated = await profileApi.uploadAvatar(file, setAvatarProgress)
      hydrate(updated)
      await syncAuthUser(updated)
      showStatus("Profile photo updated.", "success")
    } catch (err) {
      showStatus(
        err instanceof ApiError ? err.message : "Avatar upload failed",
        "error"
      )
    } finally {
      setUploadingAvatar(false)
      setAvatarProgress(0)
    }
  }

  if (loading) {
    return <CardSkeleton />
  }

  if (!profile || !draft) {
    return (
      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error ?? "Profile unavailable."}
      </p>
    )
  }

  const isCandidate = profile.role === "candidate"
  const busy = saving || autoSaving

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Profile"
          description={
            isCandidate
              ? "Personal information and your latest resume — changes auto-save when valid."
              : profile.role === "recruiter"
                ? "Keep your recruiter identity and company details up to date."
                : "Manage your admin account details."
          }
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {isDirty ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={cancelChanges}
                >
                  Cancel changes
                </Button>
              ) : null}
              <Button
                type="submit"
                form="profile-form"
                disabled={busy || !isDirty}
              >
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </div>
          }
        />
      </FadeIn>

      <div className="mb-4 flex flex-col gap-2">
        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {saved}
          </p>
        ) : null}
        {!error && !saved && (statusHint || autoSaving) ? (
          <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {autoSaving ? "Auto-saving…" : statusHint}
          </p>
        ) : null}
      </div>

      <form id="profile-form" onSubmit={(e) => void onManualSave(e)} className="space-y-4">
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Avatar className="size-20">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={draft.fullName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-lg font-medium text-primary">
                    {initials(draft.fullName)}
                  </AvatarFallback>
                </Avatar>
                <label
                  className={cn(
                    "absolute -right-1 -bottom-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted",
                    uploadingAvatar && "pointer-events-none opacity-60"
                  )}
                >
                  <Camera className="size-3.5" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadingAvatar}
                    onChange={(e) => void onAvatarChange(e)}
                  />
                </label>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <CardTitle className="font-heading text-xl">
                  {draft.fullName || "Your profile"}
                </CardTitle>
                <CardDescription>
                  {draft.email} · <span className="capitalize">{profile.role}</span>
                </CardDescription>
                {uploadingAvatar ? (
                  <Progress value={avatarProgress} label="Uploading photo" />
                ) : null}
              </div>
            </CardHeader>
          </Card>
        </FadeIn>

        {isCandidate ? (
          <>
            <FadeIn>
              <Card className="border-border/70 bg-card/80 shadow-none">
                <CardHeader>
                  <CardTitle className="font-heading text-base">
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Contact details and location used across screening and assistant
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Name</Label>
                      <Input
                        id="full_name"
                        value={draft.fullName}
                        onChange={(e) => patchDraft("fullName", e.target.value)}
                        required
                        aria-invalid={Boolean(fieldErrors.fullName)}
                      />
                      <FieldError message={fieldErrors.fullName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={draft.email}
                        onChange={(e) => patchDraft("email", e.target.value)}
                        required
                        aria-invalid={Boolean(fieldErrors.email)}
                      />
                      <FieldError message={fieldErrors.email} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={draft.phone}
                        onChange={(e) => patchDraft("phone", e.target.value)}
                        placeholder="+91 98765 43210"
                        aria-invalid={Boolean(fieldErrors.phone)}
                      />
                      <FieldError message={fieldErrors.phone} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      <Input
                        id="linkedin"
                        type="url"
                        value={draft.linkedin}
                        onChange={(e) => patchDraft("linkedin", e.target.value)}
                        placeholder="https://linkedin.com/in/…"
                        aria-invalid={Boolean(fieldErrors.linkedin)}
                      />
                      <FieldError message={fieldErrors.linkedin} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="github">GitHub</Label>
                      <Input
                        id="github"
                        type="url"
                        value={draft.github}
                        onChange={(e) => patchDraft("github", e.target.value)}
                        placeholder="https://github.com/…"
                        aria-invalid={Boolean(fieldErrors.github)}
                      />
                      <FieldError message={fieldErrors.github} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Location</Label>
                    <LocationCascading
                      value={draft.location}
                      onChange={(next) => patchDraft("location", next)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Select state/UT first, then city. Saved with your profile.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn>
              <AboutMeSection
                profile={profile}
                onMessage={(message, kind) => showStatus(message, kind)}
                onSaved={async (updated) => {
                  hydrate(updated)
                  await syncAuthUser(updated)
                }}
              />
            </FadeIn>

            <FadeIn>
              <SkillsSection
                profile={profile}
                onMessage={(message, kind) => showStatus(message, kind)}
                onSaved={async (updated) => {
                  hydrate(updated)
                  await syncAuthUser(updated)
                }}
              />
            </FadeIn>

            <FadeIn>
              <EducationSection
                profile={profile}
                onMessage={(message, kind) => showStatus(message, kind)}
                onSaved={async (updated) => {
                  hydrate(updated)
                  await syncAuthUser(updated)
                }}
              />
            </FadeIn>

            <FadeIn>
              <ExperienceSection
                profile={profile}
                onMessage={(message, kind) => showStatus(message, kind)}
                onSaved={async (updated) => {
                  hydrate(updated)
                  await syncAuthUser(updated)
                }}
              />
            </FadeIn>

            <FadeIn>
              <LatestResumePanel
                mode="candidate"
                resume={{
                  id: profile.resume_id,
                  fileName: profile.resume_file_name,
                  status: profile.resume_status,
                  uploadedAt: profile.resume_uploaded_at,
                }}
                onMessage={(message, kind) => showStatus(message, kind)}
                onChanged={async () => {
                  const updated = await reloadProfile()
                  await syncAuthUser(updated)
                }}
              />
            </FadeIn>
          </>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <FadeIn>
              <Card className="border-border/70 bg-card/80 shadow-none">
                <CardHeader>
                  <CardTitle className="font-heading text-base">
                    Personal information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      value={draft.fullName}
                      onChange={(e) => patchDraft("fullName", e.target.value)}
                      required
                      aria-invalid={Boolean(fieldErrors.fullName)}
                    />
                    <FieldError message={fieldErrors.fullName} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={draft.email}
                      onChange={(e) => patchDraft("email", e.target.value)}
                      required
                      aria-invalid={Boolean(fieldErrors.email)}
                    />
                    <FieldError message={fieldErrors.email} />
                  </div>
                  {profile.role === "recruiter" ? (
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone number</Label>
                      <Input
                        id="phone"
                        value={draft.phone}
                        onChange={(e) => patchDraft("phone", e.target.value)}
                        placeholder="+91 98765 43210"
                        aria-invalid={Boolean(fieldErrors.phone)}
                      />
                      <FieldError message={fieldErrors.phone} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </FadeIn>

            {profile.role === "recruiter" ? (
              <FadeIn>
                <Card className="border-border/70 bg-card/80 shadow-none">
                  <CardHeader>
                    <CardTitle className="font-heading text-base">
                      Recruiter details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={draft.companyName}
                        onChange={(e) => patchDraft("companyName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        value={draft.jobTitle}
                        onChange={(e) => patchDraft("jobTitle", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </FadeIn>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !isDirty}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !isDirty}
            onClick={cancelChanges}
          >
            Cancel changes
          </Button>
          <span className="self-center text-xs text-muted-foreground">
            {isDirty ? "You have unsaved changes" : "All changes saved"}
          </span>
        </div>
      </form>
    </PageTransition>
  )
}
