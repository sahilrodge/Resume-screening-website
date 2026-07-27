import { apiClient } from "@/lib/api"
import type { AnalyticsOverview } from "@/types/analytics"

export const analyticsApi = {
  overview(months = 6) {
    return apiClient.get<AnalyticsOverview>("/analytics/overview", {
      params: { months },
    })
  },
}
