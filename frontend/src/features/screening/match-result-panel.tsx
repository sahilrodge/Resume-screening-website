"use client"

import { motion } from "framer-motion"
import { Check, Lightbulb, ThumbsDown, ThumbsUp, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ApplicationMatch } from "@/types/application"

function scoreTone(score: number) {
  if (score >= 75)
    return {
      stroke: "stroke-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      label: "Strong fit",
    }
  if (score >= 50)
    return {
      stroke: "stroke-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      label: "Partial fit",
    }
  return {
    stroke: "stroke-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    label: "Weak fit",
  }
}

export function MatchScoreRing({
  score,
  size = 148,
  label = "Match",
}: {
  score: number
  size?: number
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, score))
  const tone = scoreTone(clamped)
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={cn(
            "font-heading text-3xl font-semibold tabular-nums",
            tone.text
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {Math.round(clamped)}
        </motion.span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}

function BulletList({
  title,
  icon,
  items,
  empty,
}: {
  title: string
  icon: React.ReactNode
  items: string[]
  empty: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {items.length ? (
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="leading-relaxed">
              • {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

export function MatchResultPanel({ result }: { result: ApplicationMatch }) {
  const score = result.match_score ?? 0
  const ats = result.ats_score ?? 0
  const tone = scoreTone(score)

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-accent/30 shadow-none">
      <div className="grid gap-8 p-6 md:grid-cols-[200px_1fr] md:p-8">
        <div className="flex flex-col items-center justify-center gap-6 text-center">
          <div className="space-y-2">
            <MatchScoreRing score={score} label="Match" />
            <p className={cn("text-sm font-medium", tone.text)}>{tone.label}</p>
          </div>
          <div className="space-y-2">
            <MatchScoreRing score={ats} size={120} label="ATS" />
            <p className="text-xs text-muted-foreground">Applicant Tracking Score</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {result.company_name
              ? `${result.company_name} - ${result.job_title || "Role"}`
              : result.job_title || "Role"}{" "}
            · {result.candidate_name || "Candidate"}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-heading text-lg font-semibold tracking-tight">
              Summary
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {result.summary || "No summary generated."}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3.5" />
                </span>
                <h4 className="text-sm font-semibold">Matching skills</h4>
              </div>
              {result.matching_skills?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {(result.matching_skills ?? []).map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="border-transparent bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None identified</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">
                  <X className="size-3.5" />
                </span>
                <h4 className="text-sm font-semibold">Missing skills</h4>
              </div>
              {result.missing_skills?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {(result.missing_skills ?? []).map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="border-transparent bg-rose-500/12 text-rose-800 dark:text-rose-200"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No major gaps</p>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <BulletList
              title="Candidate Strengths"
              icon={
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <ThumbsUp className="size-3.5" />
                </span>
              }
              items={result.strengths ?? []}
              empty="No strengths listed"
            />
            <BulletList
              title="Weaknesses"
              icon={
                <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <ThumbsDown className="size-3.5" />
                </span>
              }
              items={result.weaknesses ?? []}
              empty="No weaknesses listed"
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <h4 className="text-sm font-semibold">Resume suggestions</h4>
            </div>
            {(result.suggestions ?? []).length ? (
              <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                {(result.suggestions ?? []).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No suggestions yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <h4 className="text-sm font-semibold">Reasoning</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {result.reasoning || "No reasoning provided."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
