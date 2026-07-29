import { apiClient } from "@/lib/api"
import type {
  Company,
  CompanyCreatePayload,
  CompanyListResponse,
  CompanyProfile,
  CompanyUpdatePayload,
} from "@/types/company"

export const companiesApi = {
  list(pageSize = 100) {
    return apiClient.get<CompanyListResponse>("/companies", {
      params: { page_size: pageSize },
    })
  },

  get(id: string) {
    return apiClient.get<CompanyProfile>(`/companies/${id}`)
  },

  create(payload: CompanyCreatePayload) {
    return apiClient.post<Company>("/companies", payload)
  },

  update(id: string, payload: CompanyUpdatePayload) {
    return apiClient.patch<Company>(`/companies/${id}`, payload)
  },
}
