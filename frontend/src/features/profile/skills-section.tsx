"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SkillsMultiSelect } from "@/features/profile/skills-multi-select"
import { profileApi } from "@/services/profile"
import { ApiError } from "@/types/api"
import type { Profile } from "@/types/profile"

type SkillsSectionProps = {
  profile: Profile
  onSaved: (updated: Profile) => void | Promise<void>
  onMessage: (message: string, kind: "success" | "error") => void
}

export function SkillsSection({
  profile,
  onSaved,
  onMessage,
}: SkillsSectionProps) {
  const baseline = useMemo(() => [...(profile.skills ?? [])], [profile.skills])
  const [skills, setSkills] = useState<string[]>(baseline)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(skills) !== JSON.stringify(baseline)

  useEffect(() => {
    setSkills([...(profile.skills ?? [])])
  }, [profile.skills])

  function cancel() {
    setSkills([...baseline])
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await profileApi.update({ skills })
      await onSaved(updated)
      onMessage("Skills saved.", "success")
    } catch (err) {
      onMessage(
        err instanceof ApiError ? err.message : "Failed to save skills",
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardHeader>
        <CardTitle className="font-heading text-base">Skills</CardTitle>
        <CardDescription>
          Searchable multi-select across industries — selected skills appear as chips
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SkillsMultiSelect value={skills} onChange={setSkills} disabled={saving} />
        <div className="flex flex-wrap gap-2">
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
