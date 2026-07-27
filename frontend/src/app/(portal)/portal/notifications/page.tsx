"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"

import { notificationsApi } from "@/services/notifications"
import type { AppNotification } from "@/types/notification"
import { Button } from "@/components/ui/button"

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function PortalNotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    notificationsApi
      .list({ page: 1, page_size: 50 })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setUnread(res.unread_count)
      })
      .catch(() => {
        if (!cancelled) setError("Could not load notifications.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function markAll() {
    try {
      const res = await notificationsApi.markAllRead()
      setUnread(res.unread_count)
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      setError("Could not mark notifications as read.")
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        {unread > 0 ? (
          <Button variant="outline" size="sm" onClick={() => void markAll()}>
            Mark all read
          </Button>
        ) : null}
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bell className="size-4" />
          No notifications yet.
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="space-y-1 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className={`text-sm ${item.is_read ? "text-muted-foreground" : "font-medium"}`}>
                {item.title}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatWhen(item.created_at)}
              </span>
            </div>
            {item.message ? (
              <p className="text-sm text-muted-foreground">{item.message}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
