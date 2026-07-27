"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, BellRing, RefreshCw } from "lucide-react"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApiLoading } from "@/hooks/use-api-loading"
import { whatsappApi } from "@/services/whatsapp"
import { ApiError } from "@/types/api"
import type { WhatsappMessage } from "@/types/whatsapp"
import { WHATSAPP_EVENT_LABELS, type WhatsappEvent } from "@/types/whatsapp"

function eventLabel(value: string | null) {
  if (!value) return "—"
  return WHATSAPP_EVENT_LABELS[value as WhatsappEvent] ?? value
}

export default function WhatsappPage() {
  const { loading } = useApiLoading()
  const [items, setItems] = useState<WhatsappMessage[]>([])
  const [total, setTotal] = useState(0)
  const [direction, setDirection] = useState<"all" | "inbound" | "outbound">("all")
  const [eventType, setEventType] = useState("all")
  const [error, setError] = useState<string | null>(null)
  const [reminderNote, setReminderNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await whatsappApi.list({
        page: 1,
        page_size: 50,
        direction: direction === "all" ? undefined : direction,
        event_type: eventType === "all" ? undefined : eventType,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load WhatsApp messages")
    }
  }, [direction, eventType])

  useEffect(() => {
    void load()
  }, [load])

  async function handleReminders() {
    setReminderNote(null)
    setError(null)
    try {
      const result = await whatsappApi.sendDueReminders()
      setReminderNote(
        `Reminders — sent: ${result.sent}, skipped: ${result.skipped}, failed: ${result.failures}`
      )
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send reminders")
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="WhatsApp"
          description="Every Twilio WhatsApp message is stored here — outbound templates and inbound replies."
          actions={
            <>
              <Button variant="outline" onClick={() => void handleReminders()}>
                <BellRing data-icon="inline-start" />
                Send due reminders
              </Button>
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw data-icon="inline-start" />
                Refresh
              </Button>
            </>
          }
        />
      </FadeIn>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {reminderNote ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {reminderNote}
        </p>
      ) : null}

      <FadeIn>
        <AdminTableShell
          title={`${total} messages`}
          description="Application received, interview invite, reminder, rejected, selected, and replies."
          toolbar={
            <div className="flex flex-wrap gap-2">
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as "all" | "inbound" | "outbound")
                }
              >
                <option value="all">All directions</option>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="all">All events</option>
                <option value="application_received">Application received</option>
                <option value="interview_invite">Interview invite</option>
                <option value="reminder">Reminder</option>
                <option value="rejected">Rejected</option>
                <option value="selected">Selected</option>
                <option value="inbound_reply">Inbound reply</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead className="hidden md:table-cell">Event</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No WhatsApp messages stored yet"}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {row.direction === "inbound" ? (
                          <ArrowDownLeft className="size-4 text-sky-600" />
                        ) : (
                          <ArrowUpRight className="size-4 text-emerald-600" />
                        )}
                        <span className="text-sm capitalize">{row.direction}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.candidate_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.direction === "inbound" ? row.from_number : row.to_number}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{eventLabel(row.event_type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {row.message_body || "—"}
                      </p>
                      {row.error_message ? (
                        <p className="mt-1 text-xs text-destructive">{row.error_message}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AdminTableShell>
      </FadeIn>
    </PageTransition>
  )
}
