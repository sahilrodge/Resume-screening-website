"use client"

import { useApiLoading } from "@/hooks/use-api-loading"
import { cn } from "@/lib/utils"

export function ApiLoadingBar() {
  const { loading } = useApiLoading()

  return (
    <div
      aria-hidden={!loading}
      className={cn(
        "pointer-events-none fixed top-0 right-0 left-0 z-50 h-0.5 overflow-hidden transition-opacity duration-200",
        loading ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="h-full w-full origin-left animate-pulse bg-primary" />
    </div>
  )
}
