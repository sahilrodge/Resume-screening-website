"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Eye, PhoneCall, RefreshCw } from "lucide-react"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApiLoading } from "@/hooks/use-api-loading"
import { voiceCallsApi } from "@/services/voice-calls"
import { ApiError } from "@/types/api"
import type { VoiceCall } from "@/types/voice-call"

export default function VoiceCallsPage() {
  const { loading } = useApiLoading()
  const [items, setItems] = useState<VoiceCall[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await voiceCallsApi.list({ page: 1, page_size: 50 })
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load voice calls")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="AI Voice Screening"
          description="Vapi calls, transcripts, and OpenAI interview scores after candidates apply."
          actions={
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
          }
        />
      </FadeIn>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <FadeIn>
        <AdminTableShell
          title={`${total} calls`}
          description="Auto-triggered on new applications when Vapi is configured."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead className="hidden md:table-cell">Job</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <PhoneCall className="size-5 opacity-60" />
                      {loading ? "Loading…" : "No Vapi screening calls yet"}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">{row.candidate_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.to_number}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.job_title || "—"}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {row.interview_score != null
                        ? `${Math.round(row.interview_score)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/voice-calls/${row.id}`}
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      >
                        <Eye />
                      </Link>
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
