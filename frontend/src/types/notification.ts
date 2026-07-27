export type NotificationType = "info" | "success" | "warning" | "alert"
export type NotificationChannel = "in_app" | "email" | "sms" | "push"
export type NotificationDeliveryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "skipped"

export type AppNotification = {
  id: string
  user_id: string
  title: string
  message: string
  notification_type: NotificationType
  channel: NotificationChannel
  delivery_status: NotificationDeliveryStatus
  is_read: boolean
  read_at: string | null
  link: string | null
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type NotificationListResponse = {
  items: AppNotification[]
  total: number
  page: number
  page_size: number
  pages: number
  unread_count: number
  channel_counts: Record<string, number>
}

export type UnreadCountResponse = {
  unread_count: number
}

export type NotificationPreferences = {
  email_enabled: boolean
  in_app_enabled: boolean
  push_enabled: boolean
  vapid_public_key: string | null
  smtp_configured: boolean
  push_configured: boolean
}

export type NotificationPreferenceUpdate = {
  email_enabled?: boolean
  in_app_enabled?: boolean
  push_enabled?: boolean
}

export type NotificationListParams = {
  page?: number
  page_size?: number
  channel?: NotificationChannel
  unread_only?: boolean
}
