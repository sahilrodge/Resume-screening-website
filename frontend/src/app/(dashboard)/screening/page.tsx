"use client"

import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import ScreeningPageClient from "@/features/screening/screening-page-client"

export default function ScreeningPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-1">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      }
    >
      <ScreeningPageClient />
    </Suspense>
  )
}
