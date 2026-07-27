import { apiClient } from "@/lib/api"
import type {
  ApplicationListResponse,
  ApplicationMatch,
  ComparePayload,
} from "@/types/application"

export const applicationsApi = {
  compare(payload: ComparePayload) {
    return apiClient.post<ApplicationMatch>("/applications/compare", payload)
  },

  list(params?: {
    page?: number
    page_size?: number
    job_id?: string
    candidate_id?: string
    status?: string
    sort_by?: "created_at" | "match_score" | "status"
    sort_order?: "asc" | "desc"
  }) {
    return apiClient.get<ApplicationListResponse>("/applications", { params })
  },

  get(id: string) {
    return apiClient.get<ApplicationMatch>(`/applications/${id}`)
  },

  updateStatus(id: string, payload: { status: string; send_whatsapp?: boolean }) {
    return apiClient.patch<ApplicationMatch>(`/applications/${id}/status`, payload)
  },
}
