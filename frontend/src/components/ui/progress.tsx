import { cn } from "@/lib/utils"

type ProgressProps = {
  value: number
  className?: string
  label?: string
}

export function Progress({ value, className, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div className={cn("space-y-1.5", className)} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      {label ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
