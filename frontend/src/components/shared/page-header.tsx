import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  /** Hide the large h1 when the sticky navbar already shows the page title (desktop). */
  hideTitleOnDesktop?: boolean
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  hideTitleOnDesktop = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h1
          className={cn(
            "font-heading text-2xl font-semibold tracking-tight md:text-3xl",
            hideTitleOnDesktop && "md:sr-only"
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
