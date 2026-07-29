import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

const sizeClass = {
  sm: "size-9 rounded-md",
  md: "size-10 rounded-lg",
  lg: "size-12 rounded-xl",
  xl: "size-16 rounded-xl",
} as const

const iconClass = {
  sm: "size-4",
  md: "size-4",
  lg: "size-5",
  xl: "size-7",
} as const

type HirePulseMarkProps = {
  size?: keyof typeof sizeClass
  className?: string
  /** Accessible label; defaults to HirePulse */
  label?: string
}

/**
 * Default HirePulse brand mark used in place of external company logos.
 */
export function HirePulseMark({
  size = "md",
  className,
  label = "HirePulse",
}: HirePulseMarkProps) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-border bg-primary text-primary-foreground shadow-none",
        sizeClass[size],
        className
      )}
    >
      <Sparkles className={iconClass[size]} aria-hidden />
    </span>
  )
}
