import { api, apiClient } from "@/lib/api"
import type { Resume, ResumeListResponse, ResumePreview } from "@/types/resume"

const UPLOAD_TIMEOUT_MS = 120_000

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

function openExternalUrl(url: string, fileName?: string) {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.target = "_blank"
  anchor.rel = "noopener noreferrer"
  if (fileName) anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

async function downloadViaApi(path: string, fileName: string) {
  const response = await api.get<Blob>(path, {
    responseType: "blob",
    skipLoading: true,
  })
  triggerBlobDownload(response.data, fileName)
}

export const resumesApi = {
  list(params?: {
    candidate_id?: string
    search?: string
    page?: number
    page_size?: number
  }) {
    return apiClient.get<ResumeListResponse>("/resumes", { params })
  },

  async fetchBlob(id: string) {
    const response = await api.get<Blob>(`/resumes/${id}/download`, {
      responseType: "blob",
      skipLoading: true,
      params: { inline: true },
    })
    return response.data
  },

  async fetchBlobMine(id: string) {
    const response = await api.get<Blob>(`/resumes/me/${id}/download`, {
      responseType: "blob",
      skipLoading: true,
      params: { inline: true },
    })
    return response.data
  },

  get(id: string) {
    return apiClient.get<Resume>(`/resumes/${id}`)
  },

  preview(id: string) {
    return apiClient.get<ResumePreview>(`/resumes/${id}/preview`)
  },

  async upload(
    payload: {
      candidateId: string
      file: File
      isPrimary?: boolean
      replaceExisting?: boolean
    },
    onProgress?: (percent: number) => void
  ) {
    const form = new FormData()
    form.append("candidate_id", payload.candidateId)
    form.append("file", payload.file)
    form.append("is_primary", String(Boolean(payload.isPrimary)))
    form.append("replace_existing", String(Boolean(payload.replaceExisting)))

    const { data } = await api.post<Resume>("/resumes/upload", form, {
      skipLoading: true,
      timeout: UPLOAD_TIMEOUT_MS,
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

  async uploadMine(
    payload: {
      file: File
      isPrimary?: boolean
      replaceExisting?: boolean
    },
    onProgress?: (percent: number) => void
  ) {
    const form = new FormData()
    form.append("file", payload.file)
    form.append("is_primary", String(payload.isPrimary ?? true))
    form.append("replace_existing", String(payload.replaceExisting ?? true))
    const { data } = await api.post<Resume>("/resumes/me/upload", form, {
      skipLoading: true,
      timeout: UPLOAD_TIMEOUT_MS,
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

  listMine(params?: { page?: number; page_size?: number }) {
    return apiClient.get<ResumeListResponse>("/resumes/me", { params })
  },

  previewMine(id: string) {
    return apiClient.get<ResumePreview>(`/resumes/me/${id}/preview`)
  },

  remove(id: string) {
    return apiClient.delete<{ message: string }>(`/resumes/${id}`)
  },

  removeMine(id: string) {
    return apiClient.delete<{ message: string }>(`/resumes/me/${id}`)
  },

  async download(id: string, fileName?: string) {
    const preview = await this.preview(id)
    const name = fileName || preview.file_name || "resume"
    const url = preview.download_url || preview.preview_url
    if (/^https?:\/\//i.test(url)) {
      openExternalUrl(url, name)
      return
    }
    await downloadViaApi(`/resumes/${id}/download`, name)
  },

  async downloadMine(id: string, fileName?: string) {
    const preview = await this.previewMine(id)
    const name = fileName || preview.file_name || "resume"
    const url = preview.download_url || preview.preview_url
    if (/^https?:\/\//i.test(url)) {
      openExternalUrl(url, name)
      return
    }
    await downloadViaApi(`/resumes/me/${id}/download`, name)
  },
}
