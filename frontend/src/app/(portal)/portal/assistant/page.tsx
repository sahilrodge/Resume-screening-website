"use client"

import { AssistantChat } from "@/features/assistant/assistant-chat"

export default function PortalAssistantPage() {
  return (
    <AssistantChat
      mode="candidate"
      title="AI Assistant"
      description="Ask how HirePulse works (resume upload, jobs, screening, ATS, profile, settings) or get resume review, interview prep, and career guidance. Conversation context is kept."
      emptyHint="Try: “How do I upload my resume?” or ask for ATS tips, interview prep, or career advice."
      inputPlaceholder="Ask about HirePulse features, resume review, ATS, interviews, or career guidance…"
    />
  )
}
