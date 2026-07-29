"use client"

import { useState } from "react"
import { Bell } from "lucide-react"

import { notificationsApi } from "@/services/notifications"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { Button } from "@/components/ui/button"
import { useCandidateSync } from "@/features/candidate/candidate-sync-provider"

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
  const {
    notifications,
    unreadCount,
    loading,
    error: syncError,
    setNotifications,
    setUnreadCount,
    refresh,
  } = useCandidateSync()
  const [error, setError] = useState<string | null>(null)

  async function markAll() {
    try {
      const res = await notificationsApi.markAllRead()
      setUnreadCount(res.unread_count)
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })))
      await refresh({ silent: true })
    } catch {
      setError("Could not mark notifications as read.")
    }
  }

  const displayError = error || syncError

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => void markAll()}
          >
            Mark all read
          </Button>
        ) : null}
      </header>

      {loading ? <PageSkeleton withHeader={false} rows={5} /> : null}
      {displayError ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {displayError}
        </p>
      ) : null}

      {!loading && notifications.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bell className="size-4" />
          No notifications yet.
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {notifications.map((item) => (
          <li key={item.id} className="space-y-1 py-4">
            <div className="flex items-center justify-between gap-3">
              <p
                className={`text-sm ${item.is_read ? "text-muted-foreground" : "font-medium"}`}
              >
                {item.title}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatWhen(item.created_at)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{item.message}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
