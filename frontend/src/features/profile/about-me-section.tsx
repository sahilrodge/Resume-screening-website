"use client"

import { useEffect, useState } from "react"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { profileApi } from "@/services/profile"
import { ApiError } from "@/types/api"
import type { Profile } from "@/types/profile"

type AboutMeSectionProps = {
  profile: Profile
  onSaved: (updated: Profile) => void | Promise<void>
  onMessage: (message: string, kind: "success" | "error") => void
}

export function AboutMeSection({
  profile,
  onSaved,
  onMessage,
}: AboutMeSectionProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(profile.summary ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setValue(profile.summary ?? "")
  }, [profile.summary, editing])

  function cancel() {
    setValue(profile.summary ?? "")
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await profileApi.update({
        summary: value.trim() || null,
      })
      await onSaved(updated)
      setEditing(false)
      onMessage("About Me saved.", "success")
    } catch (err) {
      onMessage(
        err instanceof ApiError ? err.message : "Failed to save About Me",
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-heading text-base">About Me</CardTitle>
          <CardDescription>
            Short bio recruiters and the AI assistant can use
          </CardDescription>
        </div>
        {!editing ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="about_me">About Me</Label>
              <textarea
                id="about_me"
                value={value}
                rows={6}
                placeholder="Tell recruiters about your background, strengths, and career goals…"
                className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" disabled={saving} onClick={cancel}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {(profile.summary || "").trim() || "No About Me added yet."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
