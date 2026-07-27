"use client"

import { motion } from "framer-motion"
import { Check, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ApplicationMatch } from "@/types/application"

function scoreTone(score: number) {
  if (score >= 75) return { stroke: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Strong fit" }
  if (score >= 50) return { stroke: "stroke-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Partial fit" }
  return { stroke: "stroke-rose-500", text: "text-rose-600 dark:text-rose-400", label: "Weak fit" }
}

export function MatchScoreRing({
  score,
  size = 148,
}: {
  score: number
  size?: number
}) {
  const clamped = Math.max(0, Math.min(100, score))
  const tone = scoreTone(clamped)
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
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
          className={cn("font-heading text-3xl font-semibold tabular-nums", tone.text)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {Math.round(clamped)}
        </motion.span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Match
        </span>
      </div>
    </div>
  )
}

export function MatchResultPanel({ result }: { result: ApplicationMatch }) {
  const score = result.match_score ?? 0
  const tone = scoreTone(score)

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-accent/30 shadow-none">
      <div className="grid gap-8 p-6 md:grid-cols-[180px_1fr] md:p-8">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <MatchScoreRing score={score} />
          <p className={cn("text-sm font-medium", tone.text)}>{tone.label}</p>
          <p className="text-xs text-muted-foreground">
            {result.job_title || "Role"} · {result.candidate_name || "Candidate"}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-heading text-lg font-semibold tracking-tight">Summary</h3>
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
              {result.matching_skills.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.matching_skills.map((skill) => (
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
              {result.missing_skills.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.missing_skills.map((skill) => (
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
