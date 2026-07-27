import { api, apiClient } from "@/lib/api"
import type { Resume, ResumeListResponse, ResumePreview } from "@/types/resume"

export const resumesApi = {
  list(params?: { candidate_id?: string; page?: number; page_size?: number }) {
    return apiClient.get<ResumeListResponse>("/resumes", { params })
  },

  get(id: string) {
    return apiClient.get<Resume>(`/resumes/${id}`)
  },

  preview(id: string) {
    return apiClient.get<ResumePreview>(`/resumes/${id}/preview`)
  },

  async upload(payload: {
    candidateId: string
    file: File
    isPrimary?: boolean
  }) {
    const form = new FormData()
    form.append("candidate_id", payload.candidateId)
    form.append("file", payload.file)
    form.append("is_primary", String(Boolean(payload.isPrimary)))

    const { data } = await api.post<Resume>("/resumes/upload", form)
    return data
  },

  async uploadMine(payload: { file: File; isPrimary?: boolean }) {
    const form = new FormData()
    form.append("file", payload.file)
    form.append("is_primary", String(payload.isPrimary ?? true))
    const { data } = await api.post<Resume>("/resumes/me/upload", form)
    return data
  },

  listMine(params?: { page?: number; page_size?: number }) {
    return apiClient.get<ResumeListResponse>("/resumes/me", { params })
  },

  remove(id: string) {
    return apiClient.delete<{ message: string }>(`/resumes/${id}`)
  },

  /**
   * Open the Cloudinary file URL from preview metadata.
   * Avoids XHR-following the API 302 (which breaks auth and CORS on CDN).
   */
  async download(id: string, fileName?: string) {
    const preview = await apiClient.get<ResumePreview>(`/resumes/${id}/preview`)
    const url = preview.download_url || preview.preview_url
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    if (fileName || preview.file_name) {
      anchor.download = fileName || preview.file_name
    }
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  },
}
