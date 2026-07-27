"use client"

import { useEffect, useState } from "react"
import { Camera, Plus, Trash2 } from "lucide-react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
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
import { useAuth } from "@/features/auth/auth-provider"
import { authStorage } from "@/lib/auth-storage"
import { profileApi } from "@/services/profile"
import { resumesApi } from "@/services/resumes"
import { ApiError } from "@/types/api"
import type { EducationItem, ExperienceItem } from "@/types/candidate"
import type { Profile } from "@/types/profile"

function initials(name?: string | null) {
  if (!name) return "HP"
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function emptyEducation(): EducationItem {
  return {
    institution: "",
    degree: "",
    field: "",
    start_date: "",
    end_date: "",
  }
}

function emptyExperience(): ExperienceItem {
  return {
    company: "",
    title: "",
    start_date: "",
    end_date: "",
    description: "",
  }
}

export function ProfilePageClient() {
  const { user, refreshUser } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [location, setLocation] = useState("")
  const [linkedin, setLinkedin] = useState("")
  const [github, setGithub] = useState("")
  const [skillsText, setSkillsText] = useState("")
  const [education, setEducation] = useState<EducationItem[]>([])
  const [experience, setExperience] = useState<ExperienceItem[]>([])
  const [companyName, setCompanyName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")

  function hydrate(data: Profile) {
    setProfile(data)
    setFullName(data.full_name)
    setPhone(data.phone ?? "")
    setLocation(data.location ?? "")
    setLinkedin(data.linkedin_url ?? "")
    setGithub(data.github_url ?? "")
    setSkillsText((data.skills ?? []).join(", "))
    setEducation(
      data.education?.length
        ? data.education.map((item) => ({
            institution: item.institution ?? "",
            degree: item.degree ?? "",
            field: item.field ?? "",
            start_date: item.start_date ?? "",
            end_date: item.end_date ?? "",
          }))
        : []
    )
    setExperience(
      data.experience?.length
        ? data.experience.map((item) => ({
            company: item.company ?? "",
            title: item.title ?? "",
            start_date: item.start_date ?? "",
            end_date: item.end_date ?? "",
            description: item.description ?? "",
          }))
        : []
    )
    setCompanyName(data.company_name ?? "")
    setJobTitle(data.job_title ?? "")
  }

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
    }
  }, [])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      if (newPassword && newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters")
      }
      if (newPassword && !currentPassword) {
        throw new Error("Current password is required to change password")
      }

      const payload =
        profile.role === "candidate"
          ? {
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              location: location.trim() || null,
              linkedin_url: linkedin.trim() || null,
              github_url: github.trim() || null,
              skills: skillsText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              education,
              experience,
              current_password: newPassword ? currentPassword : undefined,
              new_password: newPassword || undefined,
            }
          : profile.role === "recruiter"
            ? {
                full_name: fullName.trim(),
                phone: phone.trim() || null,
                company_name: companyName.trim() || null,
                job_title: jobTitle.trim() || null,
                current_password: newPassword ? currentPassword : undefined,
                new_password: newPassword || undefined,
              }
            : {
                full_name: fullName.trim(),
                current_password: newPassword ? currentPassword : undefined,
                new_password: newPassword || undefined,
              }

      const updated = await profileApi.update(payload)
      hydrate(updated)
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
      setCurrentPassword("")
      setNewPassword("")
      setEditing(false)
      setSaved("Profile saved.")
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save profile"
      )
    } finally {
      setSaving(false)
    }
  }

  async function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploadingAvatar(true)
    setError(null)
    setSaved(null)
    try {
      const updated = await profileApi.uploadAvatar(file)
      hydrate(updated)
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
      setSaved("Profile picture updated.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Avatar upload failed")
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function onResumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploadingResume(true)
    setError(null)
    setSaved(null)
    try {
      await resumesApi.uploadMine({ file, isPrimary: true })
      const refreshed = await profileApi.me()
      hydrate(refreshed)
      setSaved("Resume uploaded.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Resume upload failed")
    } finally {
      setUploadingResume(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile…</p>
  }

  if (!profile) {
    return (
      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error ?? "Profile unavailable."}
      </p>
    )
  }

  const roleLabel = profile.role

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Profile"
          description={
            profile.role === "candidate"
              ? "Your candidate profile, resume, and career details."
              : profile.role === "recruiter"
                ? "Your recruiter identity and company details."
                : "Your admin account details."
          }
          actions={
            editing ? null : (
              <Button onClick={() => setEditing(true)}>Edit profile</Button>
            )
          }
        />
      </FadeIn>

      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mb-4 text-sm text-muted-foreground">{saved}</p>
      ) : null}

      <form onSubmit={saveProfile} className="space-y-4">
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Avatar className="size-20">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-lg font-medium text-primary">
                    {initials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute -right-1 -bottom-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted">
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
              <div className="min-w-0 space-y-1">
                <CardTitle className="font-heading text-xl">
                  {profile.full_name}
                </CardTitle>
                <CardDescription>
                  {profile.email} ·{" "}
                  <span className="capitalize">{roleLabel}</span>
                  {uploadingAvatar ? " · Uploading photo…" : ""}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </FadeIn>

        <div className="grid gap-4 lg:grid-cols-2">
          <FadeIn>
            <Card className="border-border/70 bg-card/80 shadow-none">
              <CardHeader>
                <CardTitle className="font-heading text-base">Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Name</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!editing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile.email} disabled />
                </div>
                {profile.role === "admin" ? (
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" value={profile.role} disabled className="capitalize" />
                  </div>
                ) : null}
                {(profile.role === "candidate" || profile.role === "recruiter") && (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={!editing}
                    />
                  </div>
                )}
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
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={!editing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      disabled={!editing}
                    />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ) : null}

          {profile.role === "candidate" ? (
            <FadeIn>
              <Card className="border-border/70 bg-card/80 shadow-none">
                <CardHeader>
                  <CardTitle className="font-heading text-base">
                    Candidate details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      disabled={!editing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      type="url"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      disabled={!editing}
                      placeholder="https://linkedin.com/in/…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="github">GitHub</Label>
                    <Input
                      id="github"
                      type="url"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      disabled={!editing}
                      placeholder="https://github.com/…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skills">Skills</Label>
                    <Input
                      id="skills"
                      value={skillsText}
                      onChange={(e) => setSkillsText(e.target.value)}
                      disabled={!editing}
                      placeholder="Python, React, SQL"
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list
                    </p>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ) : null}
        </div>

        {profile.role === "candidate" ? (
          <>
            <FadeIn>
              <Card className="border-border/70 bg-card/80 shadow-none">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-heading text-base">Education</CardTitle>
                    <CardDescription>Schools and degrees</CardDescription>
                  </div>
                  {editing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEducation((prev) => [...prev, emptyEducation()])}
                    >
                      <Plus data-icon="inline-start" />
                      Add
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {education.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No education added.</p>
                  ) : null}
                  {education.map((item, index) => (
                    <div
                      key={`edu-${index}`}
                      className="grid gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-2"
                    >
                      <Input
                        placeholder="Institution"
                        value={item.institution ?? ""}
                        disabled={!editing}
                        onChange={(e) =>
                          setEducation((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, institution: e.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Degree"
                        value={item.degree ?? ""}
                        disabled={!editing}
                        onChange={(e) =>
                          setEducation((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, degree: e.target.value } : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Field"
                        value={item.field ?? ""}
                        disabled={!editing}
                        onChange={(e) =>
                          setEducation((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, field: e.target.value } : row
                            )
                          )
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Start"
                          value={item.start_date ?? ""}
                          disabled={!editing}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((row, i) =>
                                i === index
                                  ? { ...row, start_date: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="End"
                          value={item.end_date ?? ""}
                          disabled={!editing}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((row, i) =>
                                i === index
                                  ? { ...row, end_date: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </div>
                      {editing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="sm:col-span-2"
                          onClick={() =>
                            setEducation((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 data-icon="inline-start" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn>
              <Card className="border-border/70 bg-card/80 shadow-none">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-heading text-base">Experience</CardTitle>
                    <CardDescription>Work history</CardDescription>
                  </div>
                  {editing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExperience((prev) => [...prev, emptyExperience()])
                      }
                    >
                      <Plus data-icon="inline-start" />
                      Add
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {experience.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No experience added.</p>
                  ) : null}
                  {experience.map((item, index) => (
                    <div
                      key={`exp-${index}`}
                      className="grid gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-2"
                    >
                      <Input
                        placeholder="Company"
                        value={item.company ?? ""}
                        disabled={!editing}
                        onChange={(e) =>
                          setExperience((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, company: e.target.value } : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Title"
                        value={item.title ?? ""}
                        disabled={!editing}
                        onChange={(e) =>
                          setExperience((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, title: e.target.value } : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Start"
                        value={item.start_date ?? ""}
                        disabled={!editing}
                        onChange={(e) =>
                          setExperience((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, start_date: e.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="End"
                        value={item.end_date ?? ""}
                        disabled={!editing}
                        onChange={(e) =>
                          setExperience((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, end_date: e.target.value } : row
                            )
                          )
                        }
                      />
                      <textarea
                        placeholder="Description"
                        value={item.description ?? ""}
                        disabled={!editing}
                        rows={3}
                        className="col-span-full flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                        onChange={(e) =>
                          setExperience((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, description: e.target.value }
                                : row
                            )
                          )
                        }
                      />
                      {editing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="sm:col-span-2"
                          onClick={() =>
                            setExperience((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                        >
                          <Trash2 data-icon="inline-start" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn>
              <Card className="border-border/70 bg-card/80 shadow-none">
                <CardHeader>
                  <CardTitle className="font-heading text-base">Resume</CardTitle>
                  <CardDescription>
                    Upload a PDF used when applying to jobs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.resume_file_name ? (
                    <p className="text-sm">
                      {profile.resume_file_name}
                      {profile.resume_status
                        ? ` · ${profile.resume_status}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No resume uploaded.</p>
                  )}
                  <Input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={uploadingResume}
                    onChange={(e) => void onResumeChange(e)}
                  />
                  {uploadingResume ? (
                    <p className="text-sm text-muted-foreground">Uploading…</p>
                  ) : null}
                </CardContent>
              </Card>
            </FadeIn>
          </>
        ) : null}

        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-base">Change password</CardTitle>
              <CardDescription>
                Leave blank to keep your current password
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current password</Label>
                <Input
                  id="current_password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={!editing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New password</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={!editing}
                />
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {editing ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                hydrate(profile)
                setCurrentPassword("")
                setNewPassword("")
                setEditing(false)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </form>

      {!editing && user ? null : null}
    </PageTransition>
  )
}
