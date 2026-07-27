import type { ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AdminTableShellProps = {
  title: string
  description?: string
  toolbar?: ReactNode
  children: ReactNode
}

export function AdminTableShell({
  title,
  description,
  toolbar,
  children,
}: AdminTableShellProps) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur transition-shadow duration-300 hover:shadow-md/20">
      <CardHeader className="gap-4">
        <div>
          <CardTitle className="font-heading">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {toolbar}
      </CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  )
}
