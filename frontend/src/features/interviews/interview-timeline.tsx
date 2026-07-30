"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import type { InterviewTimelineStep } from "@/services/interviews"

function formatWhen(iso?: string | null) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function InterviewTimeline({
  steps,
  className,
}: {
  steps: InterviewTimelineStep[]
  className?: string
}) {
  if (!steps?.length) return null

  return (
    <ol
      className={cn(
        "grid gap-3 sm:grid-cols-5",
        className
      )}
      aria-label="Interview timeline"
    >
      {steps.map((step, index) => {
        const when = formatWhen(step.at)
        return (
          <li key={step.key} className="relative min-w-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-3 left-[1.15rem] hidden h-px w-[calc(100%-0.5rem)] sm:block",
                  step.completed ? "bg-emerald-500/50" : "bg-border"
                )}
              />
            ) : null}
            <div className="flex items-start gap-2.5 sm:flex-col sm:items-start">
              <span
                className={cn(
                  "relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  step.completed || step.current
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                {step.completed ? <Check className="size-3.5" /> : index + 1}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p
                  className={cn(
                    "text-xs font-medium leading-snug",
                    step.current && "text-foreground",
                    !step.current && !step.completed && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {when ? (
                  <p className="text-[11px] text-muted-foreground">{when}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/80">
                    {step.completed || step.current ? "Updated" : "Pending"}
                  </p>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
