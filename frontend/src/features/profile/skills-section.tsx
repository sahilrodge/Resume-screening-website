"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SkillsMultiSelect } from "@/features/profile/skills-multi-select"

type SkillsSectionProps = {
  value: string[]
  disabled?: boolean
  onChange: (skills: string[]) => void
}

export function SkillsSection({
  value,
  disabled = false,
  onChange,
}: SkillsSectionProps) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardHeader>
        <CardTitle className="font-heading text-base">Skills</CardTitle>
        <CardDescription>
          Search by skill or category and manage chips below. Changes save with the profile Save button.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SkillsMultiSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  )
}
