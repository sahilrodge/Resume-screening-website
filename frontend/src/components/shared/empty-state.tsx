import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-border/80 bg-card/50 shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="size-6" />
        </span>
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
