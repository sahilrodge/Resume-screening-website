import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardProps = {
  title: string
  value: string
  delta: string
  trend?: "up" | "down" | "neutral"
  icon: LucideIcon
  className?: string
}

export function StatCard({
  title,
  value,
  delta,
  trend = "neutral",
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("border-border/70 bg-card/80 shadow-none backdrop-blur", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-2xl font-semibold tracking-tight">{value}</div>
        <p
          className={cn(
            "mt-1 text-xs",
            trend === "up" && "text-emerald-600 dark:text-emerald-400",
            trend === "down" && "text-rose-600 dark:text-rose-400",
            trend === "neutral" && "text-muted-foreground"
          )}
        >
          {delta}
        </p>
      </CardContent>
    </Card>
  )
}
