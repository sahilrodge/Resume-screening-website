"use client"

import { useState } from "react"
import { Bell } from "lucide-react"

import { notificationsApi } from "@/services/notifications"
import { EmptyState } from "@/components/shared/empty-state"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
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
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"
        }
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => void markAll()}
            >
              Mark all read
            </Button>
          ) : null
        }
      />

      {loading ? <PageSkeleton withHeader={false} rows={5} /> : null}
      {displayError ? (
        <InlineAlert variant="error">{displayError}</InlineAlert>
      ) : null}

      {!loading && notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Updates about applications and screening will show up here."
        />
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
