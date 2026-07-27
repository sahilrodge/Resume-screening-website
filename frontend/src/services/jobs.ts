import { apiClient } from "@/lib/api"
import type {
  Job,
  JobCreatePayload,
  JobDashboardStats,
  JobListParams,
  JobListResponse,
  JobUpdatePayload,
} from "@/types/job"

function toQuery(params: JobListParams = {}) {
  const query: Record<string, string | number | boolean> = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query[key] = value as string | number | boolean
    }
  })
  return query
}

export const jobsApi = {
  list(params: JobListParams = {}) {
    return apiClient.get<JobListResponse>("/jobs", {
      params: toQuery(params),
    })
  },

  get(id: string) {
    return apiClient.get<Job>(`/jobs/${id}`)
  },

  create(payload: JobCreatePayload) {
    return apiClient.post<Job>("/jobs", payload)
  },

  update(id: string, payload: JobUpdatePayload) {
    return apiClient.patch<Job>(`/jobs/${id}`, payload)
  },

  remove(id: string) {
    return apiClient.delete<{ message: string }>(`/jobs/${id}`)
  },

  dashboardStats() {
    return apiClient.get<JobDashboardStats>("/jobs/dashboard-stats")
  },

  listOpen(params: JobListParams = {}) {
    return apiClient.get<JobListResponse>("/jobs/open", {
      params: toQuery(params),
    })
  },
}
