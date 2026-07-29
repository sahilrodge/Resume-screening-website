"use client"

import { useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { emptyExperience } from "@/features/profile/profile-form"
import { profileApi } from "@/services/profile"
import { ApiError } from "@/types/api"
import type { ExperienceItem } from "@/types/candidate"
import type { Profile } from "@/types/profile"

type ExperienceSectionProps = {
  profile: Profile
  onSaved: (updated: Profile) => void | Promise<void>
  onMessage: (message: string, kind: "success" | "error") => void
}

function cloneExperience(items: ExperienceItem[]): ExperienceItem[] {
  return items.map((item) => ({
    company: item.company ?? "",
    title: item.title ?? "",
    start_date: item.start_date ?? "",
    end_date: item.end_date ?? "",
    description: item.description ?? "",
  }))
}

export function ExperienceSection({
  profile,
  onSaved,
  onMessage,
}: ExperienceSectionProps) {
  const [items, setItems] = useState<ExperienceItem[]>(() =>
    cloneExperience(profile.experience ?? [])
  )
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty =
    JSON.stringify(items) !==
    JSON.stringify(cloneExperience(profile.experience ?? []))

  useEffect(() => {
    setItems(cloneExperience(profile.experience ?? []))
    setEditingIndex(null)
  }, [profile.experience])

  function updateRow(index: number, next: ExperienceItem) {
    setItems((prev) => prev.map((row, i) => (i === index ? next : row)))
  }

  function addRow() {
    setItems((prev) => [...prev, emptyExperience()])
    setEditingIndex(items.length)
  }

  function removeRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    setEditingIndex((current) => {
      if (current == null) return null
      if (current === index) return null
      if (current > index) return current - 1
      return current
    })
  }

  function cancel() {
    setItems(cloneExperience(profile.experience ?? []))
    setEditingIndex(null)
  }

  async function save() {
    setSaving(true)
    try {
      const cleaned = items.map((item) => ({
        company: (item.company || "").trim() || null,
        title: (item.title || "").trim() || null,
        start_date: (item.start_date || "").trim() || null,
        end_date: (item.end_date || "").trim() || null,
        description: (item.description || "").trim() || null,
      }))
      const updated = await profileApi.update({ experience: cleaned })
      await onSaved(updated)
      setEditingIndex(null)
      onMessage("Experience saved.", "success")
    } catch (err) {
      onMessage(
        err instanceof ApiError ? err.message : "Failed to save experience",
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
          <CardTitle className="font-heading text-base">Experience</CardTitle>
          <CardDescription>Add, edit, and save your work history</CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No experience added.</p>
        ) : null}

        {items.map((item, index) => {
          const isEditing = editingIndex === index
          return (
            <div
              key={`exp-${index}`}
              className="space-y-3 rounded-xl border border-border/70 p-3"
            >
              {isEditing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Company"
                    value={item.company ?? ""}
                    onChange={(e) =>
                      updateRow(index, { ...item, company: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Title"
                    value={item.title ?? ""}
                    onChange={(e) =>
                      updateRow(index, { ...item, title: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Start"
                    value={item.start_date ?? ""}
                    onChange={(e) =>
                      updateRow(index, { ...item, start_date: e.target.value })
                    }
                  />
                  <Input
                    placeholder="End"
                    value={item.end_date ?? ""}
                    onChange={(e) =>
                      updateRow(index, { ...item, end_date: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="Description"
                    value={item.description ?? ""}
                    rows={3}
                    className="col-span-full flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    onChange={(e) =>
                      updateRow(index, { ...item, description: e.target.value })
                    }
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium">
                    {item.title || "Role"}
                    {item.company ? ` · ${item.company}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[item.start_date, item.end_date].filter(Boolean).join(" – ") ||
                      "Dates n/a"}
                  </p>
                  {item.description ? (
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingIndex(isEditing ? null : index)}
                >
                  <Pencil className="size-3.5" />
                  {isEditing ? "Done editing" : "Edit"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          )
        })}

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <Button type="button" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || !dirty}
            onClick={cancel}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
