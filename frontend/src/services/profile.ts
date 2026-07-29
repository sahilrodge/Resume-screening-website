import { api, apiClient } from "@/lib/api"
import type { Profile, ProfileUpdatePayload } from "@/types/profile"

export type UploadProgressHandler = (percent: number) => void

export const profileApi = {
  me() {
    return apiClient.get<Profile>("/profile/me")
  },

  update(payload: ProfileUpdatePayload) {
    return apiClient.patch<Profile>("/profile/me", payload)
  },

  async uploadAvatar(file: File, onProgress?: UploadProgressHandler) {
    const form = new FormData()
    form.append("file", file)
    const { data } = await api.post<Profile>("/profile/me/avatar", form, {
      skipLoading: true,
      onUploadProgress: (event) => {
        if (!onProgress) return
        if (event.total && event.total > 0) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        } else {
          onProgress(Math.min(95, Math.round(event.loaded / 1024)))
        }
      },
    })
    onProgress?.(100)
    return data
  },
}
