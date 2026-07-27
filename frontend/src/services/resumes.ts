import { api, apiClient } from "@/lib/api"
import { env } from "@/config/env"
import { authStorage } from "@/lib/auth-storage"
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

  remove(id: string) {
    return apiClient.delete<{ message: string }>(`/resumes/${id}`)
  },

  /** Authenticated download URL (backend redirects to Cloudinary). */
  downloadUrl(id: string) {
    return `${env.apiUrl}/resumes/${id}/download`
  },

  async download(id: string, fileName: string) {
    const token = authStorage.getAccessToken()
    const response = await fetch(this.downloadUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      redirect: "follow",
    })
    if (!response.ok) {
      throw new Error("Download failed")
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName || "resume.pdf"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
}
