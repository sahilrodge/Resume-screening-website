"use client"

import { useState } from "react"
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
import type { ExperienceItem } from "@/types/candidate"

type ExperienceSectionProps = {
  value: ExperienceItem[]
  disabled?: boolean
  onChange: (items: ExperienceItem[]) => void
}

export function ExperienceSection({
  value,
  disabled = false,
  onChange,
}: ExperienceSectionProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  function updateRow(index: number, next: ExperienceItem) {
    onChange(value.map((row, i) => (i === index ? next : row)))
  }

  function addRow() {
    onChange([...value, emptyExperience()])
    setEditingIndex(value.length)
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index))
    setEditingIndex((current) => {
      if (current == null) return null
      if (current === index) return null
      if (current > index) return current - 1
      return current
    })
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-heading text-base">Experience</CardTitle>
          <CardDescription>
            Add and edit work history. Saved with the profile Save button.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={addRow}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">No experience added.</p>
        ) : null}

        {value.map((item, index) => {
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
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, { ...item, company: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Title"
                    value={item.title ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, { ...item, title: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Start"
                    value={item.start_date ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, { ...item, start_date: e.target.value })
                    }
                  />
                  <Input
                    placeholder="End"
                    value={item.end_date ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, { ...item, end_date: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="Description"
                    value={item.description ?? ""}
                    rows={3}
                    disabled={disabled}
                    className="col-span-full flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30"
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
                  disabled={disabled}
                  onClick={() => setEditingIndex(isEditing ? null : index)}
                >
                  <Pencil className="size-3.5" />
                  {isEditing ? "Done editing" : "Edit"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
