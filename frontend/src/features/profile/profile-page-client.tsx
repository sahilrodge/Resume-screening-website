"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Camera, Loader2 } from "lucide-react"

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
import { useCandidateSyncOptional } from "@/features/candidate/candidate-sync-provider"
import {
  buildUpdatePayload,
  draftFromProfile,
  draftsEqual,
  validateDraft,
  type ProfileDraft,
  type ProfileFieldErrors,
} from "@/features/profile/profile-form"
import { AboutMeSection } from "@/features/profile/about-me-section"
import {
  CandidateActivitySections,
  CandidateLoginInfoSection,
} from "@/features/profile/candidate-activity-sections"
import { EducationSection } from "@/features/profile/education-section"
import { ExperienceSection } from "@/features/profile/experience-section"
import { LocationCascading } from "@/features/profile/location-cascading"
import { SkillsSection } from "@/features/profile/skills-section"
import { LatestResumePanel } from "@/features/resumes/latest-resume-panel"
import { RESUME_MAX_SIZE_MB } from "@/features/resumes/resume-upload"
import { authStorage } from "@/lib/auth-storage"
import { cn } from "@/lib/utils"
import { profileApi } from "@/services/profile"
import { ApiError } from "@/types/api"
import type { Profile } from "@/types/profile"

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
  const candidateSync = useCandidateSyncOptional()
  const searchParams = useSearchParams()
  const focusNameOnEdit = searchParams.get("edit") === "1"
  const [profile, setProfile] = useState<Profile | null>(null)
  const [baseline, setBaseline] = useState<ProfileDraft | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [loading, setLoading] = useState(!candidateSync?.profile)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarProgress, setAvatarProgress] = useState(0)

  const saveLock = useRef(false)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = useMemo(() => {
    if (!draft || !baseline) return false
    return !draftsEqual(draft, baseline)
  }, [draft, baseline])

  const isDirtyRef = useRef(false)
  isDirtyRef.current = isDirty

  const showStatus = useCallback((message: string, kind: "success" | "error") => {
    if (kind === "error") {
      setError(message)
      setSaved(null)
      return
    }
    setSaved(message)
    setError(null)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setSaved(null), SUCCESS_DISMISS_MS)
  }, [])

  const hydrate = useCallback((data: Profile) => {
    const next = draftFromProfile(data)
    setProfile(data)
    setBaseline(next)
    setDraft(next)
    setFieldErrors({})
  }, [])

  const reloadProfile = useCallback(async () => {
    if (candidateSync) {
      const overview = await candidateSync.refresh({ silent: true })
      const data = overview?.profile ?? (await profileApi.me())
      hydrate(data)
      return data
    }
    const data = await profileApi.me()
    hydrate(data)
    return data
  }, [hydrate, candidateSync])

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
      candidateSync?.setProfile(updated)
    },
    [refreshUser, candidateSync]
  )

  useEffect(() => {
    if (candidateSync) {
      if (candidateSync.profile) {
        if (!isDirtyRef.current) {
          hydrate(candidateSync.profile)
        }
        setLoading(false)
      } else if (candidateSync.loading) {
        setLoading(true)
      } else if (candidateSync.error) {
        setError(candidateSync.error)
        setLoading(false)
      }
      return
    }

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
      if (successTimer.current) clearTimeout(successTimer.current)
    }
  }, [
    hydrate,
    candidateSync,
    candidateSync?.profile?.updated_at,
    candidateSync?.loading,
    candidateSync?.error,
  ])

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
      setSaved(null)
    },
    []
  )

  const persist = useCallback(async () => {
    if (!profile || !draft || saveLock.current) return false

    const errors = validateDraft(draft, profile.role)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields before saving.")
      return false
    }

    saveLock.current = true
    setSaving(true)
    setError(null)

    try {
      const payload = buildUpdatePayload(draft, profile.role)
      const updated = await profileApi.update(payload)
      hydrate(updated)
      await syncAuthUser(updated)
      if (candidateSync) {
        await candidateSync.refresh({ silent: true })
      }
      showStatus("Profile saved successfully.", "success")
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
      return false
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }, [profile, draft, hydrate, syncAuthUser, showStatus, candidateSync])

  async function onManualSave(event: React.FormEvent) {
    event.preventDefault()
    await persist()
  }

  function cancelChanges() {
    if (!baseline) return
    setDraft(baseline)
    setFieldErrors({})
    setError(null)
    setSaved(null)
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

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Profile"
          description={
            isCandidate
              ? "Edit your details, then click Save to update the database."
              : profile.role === "recruiter"
                ? "Keep your recruiter identity and company details up to date."
                : "Manage your admin account details."
          }
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={saving || !isDirty}
                onClick={cancelChanges}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="profile-form"
                disabled={saving || !isDirty}
                className="gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
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
          <p
            role="status"
            className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
          >
            {saved}
          </p>
        ) : null}
        {!error && !saved && isDirty ? (
          <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            You have unsaved changes.
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
                    (uploadingAvatar || saving) && "pointer-events-none opacity-60"
                  )}
                >
                  <Camera className="size-3.5" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadingAvatar || saving}
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
            {candidateSync ? (
              <FadeIn>
                <CandidateLoginInfoSection />
              </FadeIn>
            ) : null}

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
                        disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
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
                      Select state/UT first, then city. Saved when you click Save.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn>
              <AboutMeSection
                value={draft.summary}
                disabled={saving}
                onChange={(value) => patchDraft("summary", value)}
              />
            </FadeIn>

            <FadeIn>
              <SkillsSection
                value={draft.skills}
                disabled={saving}
                onChange={(skills) => patchDraft("skills", skills)}
              />
            </FadeIn>

            <FadeIn>
              <EducationSection
                value={draft.education}
                disabled={saving}
                onChange={(education) => patchDraft("education", education)}
              />
            </FadeIn>

            <FadeIn>
              <ExperienceSection
                value={draft.experience}
                disabled={saving}
                onChange={(experience) => patchDraft("experience", experience)}
              />
            </FadeIn>

            <FadeIn>
              <LatestResumePanel
                mode="candidate"
                title="Resume / CV"
                description={`Upload PDF, DOC, DOCX, TXT, or RTF (max ${RESUME_MAX_SIZE_MB}MB). Upload stores the file only — your name, phone, skills, and other profile fields are never overwritten. AI parsing runs only during Resume Screening.`}
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

            {candidateSync ? (
              <FadeIn>
                <CandidateActivitySections />
              </FadeIn>
            ) : null}
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
                      disabled={saving}
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
                      disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
                        onChange={(e) => patchDraft("companyName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        value={draft.jobTitle}
                        disabled={saving}
                        onChange={(e) => patchDraft("jobTitle", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </FadeIn>
            ) : null}
          </div>
        )}
      </form>
    </PageTransition>
  )
}
