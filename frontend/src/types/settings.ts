export type SupportedLanguage = "en" | "hi" | "es" | "fr" | "de"

export type UserSettings = {
  language: SupportedLanguage
  profile_discoverable: boolean
  show_email_to_recruiters: boolean
  allow_ai_processing: boolean
  share_activity_status: boolean
  updated_at?: string | null
}

export type UserSettingsUpdate = Partial<
  Omit<UserSettings, "updated_at">
>
