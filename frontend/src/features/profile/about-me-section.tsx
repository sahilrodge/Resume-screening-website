"use client"

import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type AboutMeSectionProps = {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}

export function AboutMeSection({
  value,
  disabled = false,
  onChange,
}: AboutMeSectionProps) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardHeader>
        <CardTitle className="font-heading text-base">About Me</CardTitle>
        <CardDescription>
          Short bio recruiters and the AI assistant can use. Saved with the profile Save button.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="about_me">About Me</Label>
        <textarea
          id="about_me"
          value={value}
          rows={6}
          disabled={disabled}
          placeholder="Tell recruiters about your background, strengths, and career goals…"
          className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30"
          onChange={(e) => onChange(e.target.value)}
        />
      </CardContent>
    </Card>
  )
}
