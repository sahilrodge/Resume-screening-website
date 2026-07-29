"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Bot, Loader2, Plus, SendHorizontal, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AssistantMarkdown } from "@/features/assistant/assistant-markdown"
import { cn } from "@/lib/utils"
import { assistantApi } from "@/services/assistant"
import { candidatesApi } from "@/services/candidates"
import { profileApi } from "@/services/profile"
import { ApiError } from "@/types/api"
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantMode,
  AssistantStatus,
} from "@/types/assistant"

type ContextOption = { id: string; label: string }

type AssistantChatProps = {
  mode: AssistantMode
  title: string
  description: string
  emptyHint: string
  inputPlaceholder: string
  jobOptions?: ContextOption[]
  candidateOptions?: ContextOption[]
  showContextControls?: boolean
}

function followUpsFromMessages(messages: AssistantMessage[]): string[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg.role !== "assistant") continue
    const raw = msg.meta?.follow_ups
    if (Array.isArray(raw)) {
      return raw
        .map((item) => scrubDisplayedText(String(item || "").trim()))
        .filter(Boolean)
        .slice(0, 4)
    }
  }
  return []
}

function formatAssistantError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Something went wrong. Please try again."
  }
  if (err.code === "openai_not_configured") {
    return (
      err.message ||
      "OpenAI is not configured. Ask an admin to set OPENAI_API_KEY in the backend .env and restart the API."
    )
  }
  if (err.code === "openai_quota_exceeded") {
    return (
      err.message ||
      "OpenAI quota is exhausted. Add billing/credits, then try again — or keep chatting in local guidance mode."
    )
  }
  if (err.code === "openai_auth_failed") {
    return (
      err.message ||
      "OpenAI rejected the API key. Update OPENAI_API_KEY and restart the API."
    )
  }
  if (err.code === "ai_processing_disabled") {
    return (
      err.message ||
      "AI features are disabled in your privacy settings. Enable them under Settings."
    )
  }
  if (err.code === "openai_assistant_failed" || err.status === 502) {
    return (
      err.message ||
      "The AI assistant could not complete that request. Check your API key and try again."
    )
  }
  return err.message || "Failed to talk to the assistant."
}

function modeLabel(mode: AssistantMode): string {
  if (mode === "candidate") return "Career coach"
  if (mode === "admin") return "Platform insights"
  return "Hiring assistant"
}

function formatJobContext(
  companyName?: string | null,
  jobTitle?: string | null
) {
  const company = (companyName || "").trim()
  const title = (jobTitle || "").trim()
  if (company && title) return `${company} - ${title}`
  return title || company || ""
}

function conversationContextLabel(c: {
  company_name?: string | null
  job_title?: string | null
  candidate_name?: string | null
}) {
  const job = formatJobContext(c.company_name, c.job_title)
  const candidate = (c.candidate_name || "").trim()
  if (job && candidate) return `${candidate} · ${job}`
  return job || candidate || "General"
}

/** Never show raw database IDs in chat bubbles. */
function scrubDisplayedText(text: string) {
  return text
    .replace(
      /\b(?:application_id|candidate_id|job_id|resume_id|company_id)\s*[:=]\s*\S+/gi,
      ""
    )
    .replace(/\bid\s*[:=]\s*[0-9a-f-]{36}\b/gi, "")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      ""
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Assistant is typing">
      <div className="flex items-center gap-1.5 rounded-2xl border border-border/60 bg-background/80 px-3.5 py-3">
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Thinking…</span>
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
      </div>
    </div>
  )
}

export function AssistantChat({
  mode,
  title,
  description,
  emptyHint,
  inputPlaceholder,
  jobOptions = [],
  candidateOptions = [],
  showContextControls = false,
}: AssistantChatProps) {
  const [conversations, setConversations] = useState<AssistantConversation[]>([])
  const [active, setActive] = useState<AssistantConversation | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState("")
  const [jobId, setJobId] = useState("")
  const [candidateId, setCandidateId] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionNote, setActionNote] = useState<string | null>(null)
  const [status, setStatus] = useState<AssistantStatus | null>(null)
  const [resumeLabel, setResumeLabel] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const followUps = useMemo(() => followUpsFromMessages(messages), [messages])
  // Chat always works (OpenAI or local fallback). Banner explains provider mode.
  const aiReady = true
  const openaiReady = status?.configured === true
  const contextCandidateId = candidateId || active?.candidate_id || ""

  const jobSelectItems = useMemo(
    () => [
      { value: "__any__", label: "Any / general" },
      ...jobOptions.map((j) => ({ value: j.id, label: j.label })),
    ],
    [jobOptions]
  )
  const candidateSelectItems = useMemo(
    () => [
      { value: "__any__", label: "Optional" },
      ...candidateOptions.map((c) => ({ value: c.id, label: c.label })),
    ],
    [candidateOptions]
  )

  const selectedJobLabel = useMemo(() => {
    if (!jobId) return ""
    const fromOptions = jobOptions.find((j) => j.id === jobId)?.label
    if (fromOptions) return fromOptions
    return formatJobContext(active?.company_name, active?.job_title)
  }, [jobId, jobOptions, active?.company_name, active?.job_title])

  const selectedCandidateLabel = useMemo(() => {
    if (!candidateId) return ""
    return (
      candidateOptions.find((c) => c.id === candidateId)?.label ||
      active?.candidate_name ||
      ""
    )
  }, [candidateId, candidateOptions, active?.candidate_name])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadResumeChip() {
      try {
        if (mode === "candidate") {
          const profile = await profileApi.me()
          if (!cancelled) {
            setResumeLabel(profile.resume_file_name || null)
          }
          return
        }
        if (!contextCandidateId) {
          if (!cancelled) setResumeLabel(null)
          return
        }
        const profile = await candidatesApi.getProfile(contextCandidateId)
        if (!cancelled) {
          setResumeLabel(profile.resume_file_name || null)
        }
      } catch {
        if (!cancelled) setResumeLabel(null)
      }
    }
    void loadResumeChip()
    return () => {
      cancelled = true
    }
  }, [mode, contextCandidateId])

  const loadConversations = useCallback(async () => {
    const conv = await assistantApi.listConversations({ page: 1, page_size: 40 })
    setConversations(conv.items)
    return conv.items
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([
      assistantApi.getStatus().catch(() => null),
      loadConversations(),
    ])
      .then(([statusRes, items]) => {
        if (cancelled) return
        if (statusRes) setStatus(statusRes)
        if (items.length === 0) return
        return assistantApi.getConversation(items[0].id).then((full) => {
          if (cancelled) return
          setActive(full)
          setMessages(full.messages ?? [])
          setJobId(full.job_id || "")
          setCandidateId(full.candidate_id || "")
        })
      })
      .catch((err) => {
        if (!cancelled) {
          setError(formatAssistantError(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadConversations])

  useEffect(() => {
    scrollToBottom()
  }, [messages, sending, scrollToBottom])

  async function openConversation(id: string) {
    setError(null)
    setActionNote(null)
    setOpeningId(id)
    try {
      const data = await assistantApi.getConversation(id)
      setActive(data)
      setMessages(data.messages || [])
      setJobId(data.job_id || "")
      setCandidateId(data.candidate_id || "")
    } catch (err) {
      setError(formatAssistantError(err))
    } finally {
      setOpeningId(null)
    }
  }

  async function startChat() {
    setError(null)
    setActionNote(null)
    setStarting(true)
    try {
      const created = await assistantApi.createConversation({
        title: "New chat",
        ...(showContextControls
          ? {
              job_id: jobId || undefined,
              candidate_id: candidateId || undefined,
            }
          : {}),
      })
      setActive(created)
      setMessages(created.messages || [])
      setConversations((prev) => [
        created,
        ...prev.filter((c) => c.id !== created.id),
      ])
      inputRef.current?.focus()
    } catch (err) {
      setError(formatAssistantError(err))
    } finally {
      setStarting(false)
    }
  }

  async function sendMessage(raw: string) {
    if (!active || !raw.trim() || sending) return
    const content = raw.trim()
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
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== result.conversation.id)
        return [result.conversation, ...next]
      })
      if (result.action_result?.ok) {
        setActionNote(
          `Interview scheduled${
            result.action_result.scheduled_at
              ? ` for ${String(result.action_result.scheduled_at)}`
              : ""
          }.`
        )
      } else if (result.action_result && result.action_result.ok === false) {
        setActionNote(
          String(result.action_result.message || "Could not complete action")
        )
      }
    } catch (err) {
      setError(formatAssistantError(err))
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(content)
      if (err instanceof ApiError && err.code === "openai_not_configured") {
        setStatus((prev) =>
          prev
            ? { ...prev, configured: false, message: err.message }
            : {
                configured: false,
                model: null,
                mode,
                message: err.message,
              }
        )
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {status && !openaiReady ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Local guidance mode</p>
            <p className="text-amber-900/80 dark:text-amber-100/80">{status.message}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {actionNote ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {actionNote}
        </p>
      ) : null}

      <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 p-4">
          {showContextControls ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="jobCtx">Job context</Label>
                <Select
                  value={jobId || "__any__"}
                  onValueChange={(value) =>
                    setJobId(!value || value === "__any__" ? "" : value)
                  }
                  items={jobSelectItems}
                >
                  <SelectTrigger id="jobCtx" className="w-full">
                    <SelectValue placeholder="Any / general">
                      {(value) => {
                        if (!value || value === "__any__") return null
                        return (
                          jobOptions.find((j) => j.id === value)?.label ||
                          selectedJobLabel ||
                          null
                        )
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__" label="Any / general">
                      Any / general
                    </SelectItem>
                    {jobOptions.map((j) => (
                      <SelectItem key={j.id} value={j.id} label={j.label}>
                        {j.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="candCtx">Candidate context</Label>
                <Select
                  value={candidateId || "__any__"}
                  onValueChange={(value) =>
                    setCandidateId(!value || value === "__any__" ? "" : value)
                  }
                  items={candidateSelectItems}
                >
                  <SelectTrigger id="candCtx" className="w-full">
                    <SelectValue placeholder="Optional">
                      {(value) => {
                        if (!value || value === "__any__") return null
                        return (
                          candidateOptions.find((c) => c.id === value)?.label ||
                          selectedCandidateLabel ||
                          null
                        )
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__" label="Optional">
                      Optional
                    </SelectItem>
                    {candidateOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id} label={c.label}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          <Button
            onClick={() => void startChat()}
            disabled={starting || sending}
          >
            {starting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            {starting ? "Starting…" : "New chat"}
          </Button>

          <div className="mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto">
            <p className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
              History
            </p>
            {loading ? <Skeleton className="h-20 w-full" /> : null}
            {!loading && conversations.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">No chats yet</p>
            ) : null}
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={openingId === c.id}
                onClick={() => void openConversation(c.id)}
                className={cn(
                  "w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60 disabled:opacity-60",
                  active?.id === c.id && "bg-muted"
                )}
              >
                <div className="truncate font-medium">{c.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {conversationContextLabel(c)}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-col rounded-2xl border border-border/70 bg-gradient-to-b from-card via-card to-accent/20">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading assistant…</p>
            </div>
          ) : !active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="rounded-full bg-primary/10 p-3 text-primary">
                <Sparkles className="size-5" />
              </span>
              <h2 className="font-heading text-xl font-semibold">
                Start a conversation
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">{emptyHint}</p>
              <Button onClick={() => void startChat()} disabled={starting}>
                {starting ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : null}
                {starting ? "Starting…" : "New chat"}
              </Button>
            </div>
          ) : (
            <>
              <div className="border-b border-border/60 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  <h2 className="font-heading font-semibold">{active.title}</h2>
                  {sending ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {conversationContextLabel(active) !== "General"
                    ? conversationContextLabel(active)
                    : modeLabel(mode)}
                </p>
                {resumeLabel ? (
                  <p className="mt-2 inline-flex max-w-full items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                    <span className="truncate">
                      Using latest resume:{" "}
                      <span className="font-medium text-foreground">{resumeLabel}</span>
                    </span>
                  </p>
                ) : mode === "candidate" ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    No resume on file yet — upload one in Profile for richer coaching.
                  </p>
                ) : null}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {openingId ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading chat…
                  </div>
                ) : null}
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
                      {m.role === "assistant" ? (
                        <AssistantMarkdown content={scrubDisplayedText(m.content)} />
                      ) : (
                        <p className="whitespace-pre-wrap">
                          {scrubDisplayedText(m.content)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {sending ? <TypingIndicator /> : null}
                <div ref={bottomRef} />
              </div>

              {!sending && followUps.length > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-border/40 px-4 pt-3">
                  {followUps.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={!aiReady}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void sendMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="border-t border-border/60 p-4">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void sendMessage(input)
                  }}
                >
                  <Input
                    ref={inputRef}
                    placeholder={inputPlaceholder}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={sending || Boolean(openingId) || !aiReady}
                  />
                  <Button
                    type="submit"
                    disabled={
                      sending || !input.trim() || Boolean(openingId) || !aiReady
                    }
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="size-4" />
                    )}
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
