"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bot, Plus, SendHorizontal, Sparkles } from "lucide-react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { assistantApi } from "@/services/assistant"
import { candidatesApi } from "@/services/candidates"
import { jobsApi } from "@/services/jobs"
import { ApiError } from "@/types/api"
import type { AssistantConversation, AssistantMessage } from "@/types/assistant"
import type { Candidate } from "@/types/candidate"
import type { Job } from "@/types/job"

export default function AssistantPage() {
  const [conversations, setConversations] = useState<AssistantConversation[]>([])
  const [active, setActive] = useState<AssistantConversation | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState("")
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobId, setJobId] = useState("")
  const [candidateId, setCandidateId] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionNote, setActionNote] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const loadSidebar = useCallback(async () => {
    setError(null)
    try {
      const [conv, jobData, candData] = await Promise.all([
        assistantApi.listConversations({ page: 1, page_size: 40 }),
        jobsApi.list({ page: 1, page_size: 50, status: "open" }),
        candidatesApi.list({ page: 1, page_size: 50 }),
      ])
      setConversations(conv.items)
      setJobs(jobData.items)
      setCandidates(candData.items)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load assistant")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSidebar()
  }, [loadSidebar])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  async function openConversation(id: string) {
    setError(null)
    setActionNote(null)
    try {
      const data = await assistantApi.getConversation(id)
      setActive(data)
      setMessages(data.messages || [])
      setJobId(data.job_id || "")
      setCandidateId(data.candidate_id || "")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open conversation")
    }
  }

  async function startChat() {
    setError(null)
    setActionNote(null)
    try {
      const created = await assistantApi.createConversation({
        job_id: jobId || undefined,
        candidate_id: candidateId || undefined,
        title: "New chat",
      })
      setActive(created)
      setMessages(created.messages || [])
      await loadSidebar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start chat")
    }
  }

  async function handleSend() {
    if (!active || !input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)
    setError(null)
    setActionNote(null)

    const optimistic: AssistantMessage = {
      id: `tmp-${Date.now()}`,
      conversation_id: active.id,
      role: "user",
      content,
      meta: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const result = await assistantApi.sendMessage(active.id, content)
      setActive(result.conversation)
      setMessages(result.conversation.messages || [])
      if (result.action_result?.ok) {
        setActionNote(
          `Interview scheduled${
            result.action_result.scheduled_at
              ? ` for ${String(result.action_result.scheduled_at)}`
              : ""
          }.`
        )
      } else if (result.action_result && result.action_result.ok === false) {
        setActionNote(String(result.action_result.message || "Could not complete action"))
      }
      await loadSidebar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message")
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Recruitment Assistant"
          description="Ask about jobs, get explanations, and schedule interviews. Powered by OpenAI with saved chat history."
        />
      </FadeIn>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {actionNote ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {actionNote}
        </p>
      ) : null}

      <FadeIn>
        <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 p-4">
            <div className="space-y-2">
              <Label htmlFor="jobCtx">Job context</Label>
              <select
                id="jobCtx"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">Any / general</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                    {j.company_name ? ` · ${j.company_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="candCtx">Candidate context</Label>
              <select
                id="candCtx"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
              >
                <option value="">Optional</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => void startChat()}>
              <Plus data-icon="inline-start" />
              New chat
            </Button>

            <div className="mt-2 space-y-1 overflow-y-auto">
              <p className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
                History
              </p>
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : conversations.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">No chats yet</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void openConversation(c.id)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                      active?.id === c.id && "bg-muted"
                    )}
                  >
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.job_title || c.candidate_name || "General"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex min-h-[70vh] flex-col rounded-2xl border border-border/70 bg-gradient-to-b from-card via-card to-accent/20">
            {!active ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="rounded-full bg-primary/10 p-3 text-primary">
                  <Sparkles className="size-5" />
                </span>
                <h2 className="font-heading text-xl font-semibold">Start a conversation</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Optionally pick a job and candidate, then ask about the role, hiring steps,
                  or schedule an interview.
                </p>
                <Button onClick={() => void startChat()}>New chat</Button>
              </div>
            ) : (
              <>
                <div className="border-b border-border/60 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-primary" />
                    <h2 className="font-heading font-semibold">{active.title}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[active.job_title, active.candidate_name].filter(Boolean).join(" · ") ||
                      "General hiring assistant"}
                  </p>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "border border-border/60 bg-background/80 text-foreground"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  {sending ? (
                    <div className="flex justify-start">
                      <div className="rounded-2xl border border-border/60 bg-background/80 px-3.5 py-2.5 text-sm text-muted-foreground">
                        Thinking…
                      </div>
                    </div>
                  ) : null}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-border/60 p-4">
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void handleSend()
                    }}
                  >
                    <Input
                      placeholder="Ask about a job, process, or schedule an interview…"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={sending}
                    />
                    <Button type="submit" disabled={sending || !input.trim()}>
                      <SendHorizontal className="size-4" />
                      Send
                    </Button>
                  </form>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tip: “Explain the backend engineer role” or “Schedule an interview for this
                    candidate tomorrow at 3pm”.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </FadeIn>
    </PageTransition>
  )
}
