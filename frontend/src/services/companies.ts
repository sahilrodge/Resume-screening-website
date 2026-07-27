import { apiClient } from "@/lib/api"
import type {
  Company,
  CompanyCreatePayload,
  CompanyListResponse,
} from "@/types/company"

export const companiesApi = {
  list(pageSize = 100) {
    return apiClient.get<CompanyListResponse>("/companies", {
      params: { page_size: pageSize },
    })
  },

  create(payload: CompanyCreatePayload) {
    return apiClient.post<Company>("/companies", payload)
  },
}
