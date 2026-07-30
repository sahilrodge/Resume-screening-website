"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"

import { notificationsApi } from "@/services/notifications"
import { EmptyState } from "@/components/shared/empty-state"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { Button } from "@/components/ui/button"
import { useCandidateSync } from "@/features/candidate/candidate-sync-provider"
import type { AppNotification } from "@/types/notification"

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

function resolveCandidateLink(link: string | null | undefined): string | null {
  if (!link) return null
  if (link.startsWith("/screening")) return "/portal/screening"
  return link
}

export default function PortalNotificationsPage() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
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

  async function onItemClick(item: AppNotification) {
    if (!item.is_read) {
      try {
        await notificationsApi.markRead(item.id, true)
        setUnreadCount(Math.max(0, unreadCount - 1))
        setNotifications(
          notifications.map((n) =>
            n.id === item.id ? { ...n, is_read: true } : n
          )
        )
      } catch {
        /* still allow navigation */
      }
    }
    const href = resolveCandidateLink(item.link)
    if (href) {
      startTransition(() => {
        router.push(href)
      })
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
        {notifications.map((item) => {
          const clickable = Boolean(resolveCandidateLink(item.link))
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={pending && !clickable}
                onClick={() => void onItemClick(item)}
                className={`w-full space-y-1 py-4 text-left transition-colors ${
                  clickable ? "hover:bg-muted/40" : "cursor-default"
                }`}
              >
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
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
