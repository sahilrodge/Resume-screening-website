import { api, apiClient } from "@/lib/api"
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

  updateStatus(id: string, payload: { status: string }) {
    return apiClient.patch<ApplicationMatch>(`/applications/${id}/status`, payload)
  },

  apply(payload: { job_id: string; resume_id?: string }) {
    return apiClient.post<ApplicationMatch>("/applications/apply", payload)
  },

  mine(params?: {
    page?: number
    page_size?: number
    status?: string
    sort_by?: "created_at" | "match_score" | "status"
    sort_order?: "asc" | "desc"
  }) {
    return apiClient.get<ApplicationListResponse>("/applications/me", { params })
  },

  async downloadReport(id: string) {
    const response = await api.get<Blob>(`/applications/${id}/report`, {
      responseType: "blob",
    })
    const disposition = response.headers["content-disposition"] as string | undefined
    const match = disposition?.match(/filename="?([^"]+)"?/i)
    const filename = match?.[1] || `screening-report-${id.slice(0, 8)}.md`
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
}
