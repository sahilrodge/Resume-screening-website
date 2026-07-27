import { apiClient } from "@/lib/api"
import type {
  Candidate,
  CandidateCreatePayload,
  CandidateListParams,
  CandidateListResponse,
  CandidateProfile,
  CandidateUpdatePayload,
} from "@/types/candidate"

function toQuery(params: CandidateListParams = {}) {
  const query: Record<string, string | number | boolean> = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query[key] = value as string | number | boolean
    }
  })
  return query
}

export const candidatesApi = {
  list(params: CandidateListParams = {}) {
    return apiClient.get<CandidateListResponse>("/candidates", {
      params: toQuery(params),
    })
  },

  get(id: string) {
    return apiClient.get<Candidate>(`/candidates/${id}`)
  },

  getProfile(id: string) {
    return apiClient.get<CandidateProfile>(`/candidates/${id}/profile`)
  },

  create(payload: CandidateCreatePayload) {
    return apiClient.post<Candidate>("/candidates", payload)
  },

  update(id: string, payload: CandidateUpdatePayload) {
    return apiClient.patch<Candidate>(`/candidates/${id}`, payload)
  },

  remove(id: string) {
    return apiClient.delete<{ message: string }>(`/candidates/${id}`)
  },

  me() {
    return apiClient.get<Candidate>("/candidates/me")
  },

  myProfile() {
    return apiClient.get<CandidateProfile>("/candidates/me/profile")
  },

  updateMe(payload: CandidateUpdatePayload) {
    return apiClient.patch<Candidate>("/candidates/me", payload)
  },
}
