import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "border-dashed border-border/80 bg-card/50 shadow-none",
        className
      )}
    >
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center sm:py-16">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {action}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
