import { apiClient } from "@/lib/api"
import type { VoiceCall, VoiceCallListResponse } from "@/types/voice-call"

export const voiceCallsApi = {
  list(params?: {
    page?: number
    page_size?: number
    application_id?: string
    candidate_id?: string
    status?: string
  }) {
    return apiClient.get<VoiceCallListResponse>("/voice-calls", { params })
  },

  get(id: string) {
    return apiClient.get<VoiceCall>(`/voice-calls/${id}`)
  },

  trigger(applicationId: string) {
    return apiClient.post<VoiceCall>("/voice-calls/trigger", {
      application_id: applicationId,
    })
  },
}
