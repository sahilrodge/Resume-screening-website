"use client"

import { Suspense } from "react"

import { ProfilePageClient } from "@/features/profile/profile-page-client"
import { CardSkeleton } from "@/components/shared/page-skeleton"

export default function ProfilePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <ProfilePageClient />
    </Suspense>
  )
}
