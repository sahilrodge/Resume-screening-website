export type ChatRole = "user" | "assistant" | "system"

export type AssistantMode = "candidate" | "recruiter" | "admin"

export type AssistantMessage = {
  id: string
  conversation_id: string
  role: ChatRole
  content: string
  meta: Record<string, unknown> | null
  created_at: string
}

export type AssistantConversation = {
  id: string
  title: string
  created_by_user_id: string
  candidate_id: string | null
  candidate_name: string | null
  job_id: string | null
  job_title: string | null
  company_name?: string | null
  application_id: string | null
  created_at: string
  updated_at: string
  messages: AssistantMessage[]
}

export type ConversationListResponse = {
  items: AssistantConversation[]
  total: number
}

export type ChatReplyResponse = {
  conversation: AssistantConversation
  reply: AssistantMessage
  action_result: Record<string, unknown> | null
  follow_ups: string[]
}

export type ConversationCreatePayload = {
  title?: string
  candidate_id?: string
  job_id?: string
  application_id?: string
}

export type AssistantStatus = {
  configured: boolean
  model: string | null
  mode: AssistantMode
  message: string
}
