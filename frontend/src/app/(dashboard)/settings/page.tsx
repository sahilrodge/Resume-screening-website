"use client"

import { SettingsPageClient } from "@/features/settings/settings-page-client"

export default function SettingsPage() {
  return (
    <SettingsPageClient profileHref="/profile" showPushControls />
  )
}
