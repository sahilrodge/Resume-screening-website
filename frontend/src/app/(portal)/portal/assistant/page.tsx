"use client"

import { AssistantChat } from "@/features/assistant/assistant-chat"

export default function PortalAssistantPage() {
  return (
    <AssistantChat
      mode="candidate"
      title="AI Assistant"
      description="Get resume review, ATS improvements, interview prep, and career guidance based on your profile. Chat history is saved."
      emptyHint="Start a chat to review your resume, improve ATS fit, prepare for interviews, or get career advice."
      inputPlaceholder="Ask about resume review, ATS tips, interviews, or career guidance…"
    />
  )
}
