import { apiClient } from "@/lib/api"
import type {
  ReminderSendResponse,
  WhatsappMessage,
  WhatsappMessageListResponse,
  WhatsappSendPayload,
} from "@/types/whatsapp"

export const whatsappApi = {
  list(params?: {
    page?: number
    page_size?: number
    candidate_id?: string
    direction?: "inbound" | "outbound"
    event_type?: string
  }) {
    return apiClient.get<WhatsappMessageListResponse>("/whatsapp/messages", { params })
  },

  get(id: string) {
    return apiClient.get<WhatsappMessage>(`/whatsapp/messages/${id}`)
  },

  send(payload: WhatsappSendPayload) {
    return apiClient.post<WhatsappMessage>("/whatsapp/send", payload)
  },

  sendDueReminders() {
    return apiClient.post<ReminderSendResponse>("/whatsapp/reminders/send-due")
  },
}
