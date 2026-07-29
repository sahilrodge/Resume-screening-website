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
import { emptyEducation } from "@/features/profile/profile-form"
import { profileApi } from "@/services/profile"
import { ApiError } from "@/types/api"
import type { EducationItem } from "@/types/candidate"
import type { Profile } from "@/types/profile"

type EducationSectionProps = {
  profile: Profile
  onSaved: (updated: Profile) => void | Promise<void>
  onMessage: (message: string, kind: "success" | "error") => void
}

function cloneEducation(items: EducationItem[]): EducationItem[] {
  return items.map((item) => ({
    institution: item.institution ?? "",
    degree: item.degree ?? "",
    field: item.field ?? "",
    start_date: item.start_date ?? "",
    end_date: item.end_date ?? "",
  }))
}

export function EducationSection({
  profile,
  onSaved,
  onMessage,
}: EducationSectionProps) {
  const [items, setItems] = useState<EducationItem[]>(() =>
    cloneEducation(profile.education ?? [])
  )
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty =
    JSON.stringify(items) !== JSON.stringify(cloneEducation(profile.education ?? []))

  useEffect(() => {
    setItems(cloneEducation(profile.education ?? []))
    setEditingIndex(null)
  }, [profile.education])

  function updateRow(index: number, next: EducationItem) {
    setItems((prev) => prev.map((row, i) => (i === index ? next : row)))
  }

  function addRow() {
    setItems((prev) => [...prev, emptyEducation()])
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
    setItems(cloneEducation(profile.education ?? []))
    setEditingIndex(null)
  }

  async function save() {
    setSaving(true)
    try {
      const cleaned = items.map((item) => ({
        institution: (item.institution || "").trim() || null,
        degree: (item.degree || "").trim() || null,
        field: (item.field || "").trim() || null,
        start_date: (item.start_date || "").trim() || null,
        end_date: (item.end_date || "").trim() || null,
      }))
      const updated = await profileApi.update({ education: cleaned })
      await onSaved(updated)
      setEditingIndex(null)
      onMessage("Education saved.", "success")
    } catch (err) {
      onMessage(
        err instanceof ApiError ? err.message : "Failed to save education",
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
          <CardTitle className="font-heading text-base">Education</CardTitle>
          <CardDescription>Add, edit, and save your academic history</CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No education added.</p>
        ) : null}

        {items.map((item, index) => {
          const isEditing = editingIndex === index
          return (
            <div
              key={`edu-${index}`}
              className="space-y-3 rounded-xl border border-border/70 p-3"
            >
              {isEditing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Institution"
                    value={item.institution ?? ""}
                    onChange={(e) =>
                      updateRow(index, { ...item, institution: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Degree"
                    value={item.degree ?? ""}
                    onChange={(e) =>
                      updateRow(index, { ...item, degree: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Field"
                    value={item.field ?? ""}
                    onChange={(e) =>
                      updateRow(index, { ...item, field: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium">
                    {item.degree || "Degree"}
                    {item.field ? ` in ${item.field}` : ""}
                  </p>
                  <p className="text-sm">{item.institution || "Institution n/a"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[item.start_date, item.end_date].filter(Boolean).join(" – ") ||
                      "Dates n/a"}
                  </p>
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
