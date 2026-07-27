"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bot, Plus, SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { assistantApi } from "@/services/assistant"
import { ApiError } from "@/types/api"
import type { AssistantConversation, AssistantMessage } from "@/types/assistant"

export default function PortalAssistantPage() {
  const [conversations, setConversations] = useState<AssistantConversation[]>([])
  const [active, setActive] = useState<AssistantConversation | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const loadConversations = useCallback(async () => {
    setError(null)
    try {
      const conv = await assistantApi.listConversations({ page: 1, page_size: 40 })
      setConversations(conv.items)
      if (!active && conv.items[0]) {
        const full = await assistantApi.getConversation(conv.items[0].id)
        setActive(full)
        setMessages(full.messages ?? [])
      }
    } catch {
      setError("Could not load assistant.")
    } finally {
      setLoading(false)
    }
  }, [active])

  useEffect(() => {
    void loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  async function startChat() {
    setSending(true)
    setError(null)
    try {
      const created = await assistantApi.createConversation({})
      setConversations((prev) => [created, ...prev])
      setActive(created)
      setMessages(created.messages ?? [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start chat")
    } finally {
      setSending(false)
    }
  }

  async function openConversation(id: string) {
    try {
      const full = await assistantApi.getConversation(id)
      setActive(full)
      setMessages(full.messages ?? [])
    } catch {
      setError("Could not open conversation.")
    }
  }

  async function send() {
    if (!active || !input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)
    setError(null)
    try {
      const reply = await assistantApi.sendMessage(active.id, content)
      setMessages(reply.conversation.messages ?? [])
      setActive(reply.conversation)
      setConversations((prev) =>
        prev.map((c) => (c.id === reply.conversation.id ? reply.conversation : c))
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-[min(70vh,720px)] max-w-4xl flex-col gap-4 md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-2 md:w-56">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-heading text-lg font-semibold">AI Assistant</h1>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => void startChat()}
            disabled={sending}
            aria-label="New chat"
          >
            <Plus />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {loading ? (
            <p className="p-2 text-xs text-muted-foreground">Loading…</p>
          ) : null}
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void openConversation(c.id)}
              className={cn(
                "w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                active?.id === c.id && "bg-muted font-medium"
              )}
            >
              {c.title || "New chat"}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm text-muted-foreground">
          <Bot className="size-4" />
          Ask about roles, screening, and next steps
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!active ? (
            <p className="text-sm text-muted-foreground">
              Start a new chat to ask the assistant.
            </p>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={!active || sending}
          />
          <Button type="submit" size="icon" disabled={!active || sending || !input.trim()}>
            <SendHorizontal />
          </Button>
        </form>
      </section>
    </div>
  )
}
