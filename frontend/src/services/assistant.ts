import { apiClient } from "@/lib/api"
import type {
  AssistantConversation,
  AssistantStatus,
  ChatReplyResponse,
  ConversationCreatePayload,
  ConversationListResponse,
} from "@/types/assistant"

export const assistantApi = {
  getStatus() {
    return apiClient.get<AssistantStatus>("/assistant/status")
  },

  listConversations(params?: { page?: number; page_size?: number }) {
    return apiClient.get<ConversationListResponse>("/assistant/conversations", {
      params,
    })
  },

  createConversation(payload: ConversationCreatePayload = {}) {
    return apiClient.post<AssistantConversation>("/assistant/conversations", payload)
  },

  getConversation(id: string) {
    return apiClient.get<AssistantConversation>(`/assistant/conversations/${id}`)
  },

  sendMessage(conversationId: string, content: string) {
    return apiClient.post<ChatReplyResponse>(
      `/assistant/conversations/${conversationId}/messages`,
      { content }
    )
  },
}
