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
import { emptyEducation } from "@/features/profile/profile-form"
import type { EducationItem } from "@/types/candidate"

type EducationSectionProps = {
  value: EducationItem[]
  disabled?: boolean
  onChange: (items: EducationItem[]) => void
}

export function EducationSection({
  value,
  disabled = false,
  onChange,
}: EducationSectionProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  function updateRow(index: number, next: EducationItem) {
    onChange(value.map((row, i) => (i === index ? next : row)))
  }

  function addRow() {
    onChange([...value, emptyEducation()])
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
          <CardTitle className="font-heading text-base">Education</CardTitle>
          <CardDescription>
            Add and edit academic history. Saved with the profile Save button.
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
          <p className="text-sm text-muted-foreground">No education added.</p>
        ) : null}

        {value.map((item, index) => {
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
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, { ...item, institution: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Degree"
                    value={item.degree ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, { ...item, degree: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Field"
                    value={item.field ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, { ...item, field: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
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
