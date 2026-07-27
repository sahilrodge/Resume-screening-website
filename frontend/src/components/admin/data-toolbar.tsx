"use client"

import { Search } from "lucide-react"
import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"

type DataToolbarProps = {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  actions?: ReactNode
}

export function DataToolbar({
  placeholder = "Search...",
  value,
  onChange,
  actions,
}: DataToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="h-9 bg-muted/30 pl-8"
        />
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
