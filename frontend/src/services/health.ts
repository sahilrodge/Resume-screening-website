import { apiClient } from "@/lib/api"
import type { HealthResponse } from "@/types/api"

export const healthApi = {
  get(options?: { skipLoading?: boolean }) {
    return apiClient.get<HealthResponse>("/health", {
      skipAuth: true,
      skipAuthRefresh: true,
      skipLoading: options?.skipLoading ?? true,
    })
  },
}

export const healthService = {
  get: healthApi.get,
}
