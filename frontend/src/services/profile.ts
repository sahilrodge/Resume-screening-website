import { api, apiClient } from "@/lib/api"
import type { Profile, ProfileUpdatePayload } from "@/types/profile"

export const profileApi = {
  me() {
    return apiClient.get<Profile>("/profile/me")
  },

  update(payload: ProfileUpdatePayload) {
    return apiClient.patch<Profile>("/profile/me", payload)
  },

  async uploadAvatar(file: File) {
    const form = new FormData()
    form.append("file", file)
    const { data } = await api.post<Profile>("/profile/me/avatar", form)
    return data
  },
}
