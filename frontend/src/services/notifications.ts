import { apiClient } from "@/lib/api"
import type {
  AppNotification,
  NotificationListParams,
  NotificationListResponse,
  NotificationPreferenceUpdate,
  NotificationPreferences,
  UnreadCountResponse,
} from "@/types/notification"

function toQuery(params: NotificationListParams = {}) {
  const query: Record<string, string | number | boolean> = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query[key] = value as string | number | boolean
    }
  })
  return query
}

export const notificationsApi = {
  list(params: NotificationListParams = {}) {
    return apiClient.get<NotificationListResponse>("/notifications", {
      params: toQuery(params),
    })
  },

  unreadCount() {
    return apiClient.get<UnreadCountResponse>("/notifications/unread-count", {
      skipLoading: true,
    })
  },

  markRead(id: string, is_read = true) {
    return apiClient.patch<AppNotification>(`/notifications/${id}/read`, {
      is_read,
    })
  },

  markAllRead() {
    return apiClient.post<UnreadCountResponse>("/notifications/mark-all-read")
  },

  getPreferences() {
    return apiClient.get<NotificationPreferences>("/notifications/preferences")
  },

  updatePreferences(payload: NotificationPreferenceUpdate) {
    return apiClient.patch<NotificationPreferences>(
      "/notifications/preferences",
      payload
    )
  },

  subscribePush(payload: {
    endpoint: string
    p256dh: string
    auth: string
    user_agent?: string
  }) {
    return apiClient.post("/notifications/push/subscribe", payload)
  },

  unsubscribePush(endpoint: string) {
    return apiClient.post("/notifications/push/unsubscribe", { endpoint })
  },

  test(payload?: {
    title?: string
    message?: string
    channels?: string[]
  }) {
    return apiClient.post<AppNotification[]>("/notifications/test", payload ?? {})
  },
}
