import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type PageSkeletonProps = {
  className?: string
  rows?: number
  withHeader?: boolean
  withFilters?: boolean
}

/** Consistent page-level loading placeholder. */
export function PageSkeleton({
  className,
  rows = 5,
  withHeader = true,
  withFilters = false,
}: PageSkeletonProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>      {withHeader ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 max-w-full sm:w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      ) : null}

      {withFilters ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Skeleton className="h-8 w-full sm:w-56" />
          <Skeleton className="h-8 w-full sm:w-36" />
          <Skeleton className="h-8 w-full sm:w-36" />
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 border-b border-border/50 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
          >
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5 max-w-xs" />
              <Skeleton className="h-3 w-4/5 max-w-sm" />
            </div>
            <Skeleton className="hidden h-7 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-border/70 bg-card/50 p-4 sm:p-5",
        className
      )}
      aria-busy="true"
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}

export function TableSkeleton({
  rows = 6,
  cols = 4,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-border/70", className)}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading table…</span>      <div className="hidden gap-3 border-b border-border bg-muted/40 px-4 py-3 sm:grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      <div className="divide-y divide-border/70">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-2 px-4 py-3 sm:gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-4 w-full", c > 0 && "hidden sm:block")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
