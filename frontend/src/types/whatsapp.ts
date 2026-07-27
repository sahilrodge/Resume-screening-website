export type WhatsappDirection = "inbound" | "outbound"

export type WhatsappStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"

export type WhatsappEvent =
  | "application_received"
  | "interview_invite"
  | "reminder"
  | "rejected"
  | "selected"
  | "inbound_reply"
  | "manual"

export type WhatsappMessage = {
  id: string
  user_id: string | null
  candidate_id: string | null
  candidate_name: string | null
  to_number: string
  from_number: string
  direction: WhatsappDirection
  status: WhatsappStatus
  message_body: string | null
  provider_message_id: string | null
  error_message: string | null
  event_type: string | null
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type WhatsappMessageListResponse = {
  items: WhatsappMessage[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type WhatsappSendPayload = {
  candidate_id: string
  event?: WhatsappEvent
  body?: string
  application_id?: string
  interview_id?: string
}

export type ReminderSendResponse = {
  sent: number
  skipped: number
  failures: number
  items: WhatsappMessage[]
}

export const WHATSAPP_EVENT_LABELS: Record<WhatsappEvent, string> = {
  application_received: "Application received",
  interview_invite: "Interview invite",
  reminder: "Reminder",
  rejected: "Rejected",
  selected: "Selected",
  inbound_reply: "Inbound reply",
  manual: "Manual",
}
