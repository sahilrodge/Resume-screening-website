import { apiClient } from "@/lib/api"
import type { UserSettings, UserSettingsUpdate } from "@/types/settings"

export const settingsApi = {
  me() {
    return apiClient.get<UserSettings>("/settings/me")
  },

  update(payload: UserSettingsUpdate) {
    return apiClient.patch<UserSettings>("/settings/me", payload)
  },
}
