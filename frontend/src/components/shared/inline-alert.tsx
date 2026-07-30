import type { ReactNode } from "react"
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

const variants = {
  error: {
    wrap: "border-destructive/30 bg-destructive/5 text-destructive",
    icon: AlertCircle,
  },
  success: {
    wrap: "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200",
    icon: CheckCircle2,
  },
  warning: {
    wrap: "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200",
    icon: TriangleAlert,
  },
  info: {
    wrap: "border-sky-500/30 bg-sky-500/5 text-sky-900 dark:text-sky-200",
    icon: Info,
  },
} as const

export type InlineAlertVariant = keyof typeof variants

type InlineAlertProps = {
  variant?: InlineAlertVariant
  children: ReactNode
  className?: string
  role?: "alert" | "status"
}

/** Consistent inline banner for errors, success, warnings, and info. */
export function InlineAlert({
  variant = "error",
  children,
  className,
  role = variant === "error" ? "alert" : "status",
}: InlineAlertProps) {
  const config = variants[variant]
  const Icon = config.icon
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed",
        config.wrap,
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
