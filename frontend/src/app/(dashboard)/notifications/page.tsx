"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Bell,
  CheckCheck,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Radio,
} from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { notificationsApi } from "@/services/notifications"
import type {
  AppNotification,
  NotificationChannel,
} from "@/types/notification"

const channelTabs: { key: NotificationChannel | "all"; label: string; icon: typeof Bell }[] = [
  { key: "all", label: "All", icon: Bell },
  { key: "in_app", label: "In-app", icon: MonitorSmartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "push", label: "Push", icon: Radio },
]

function channelIcon(channel: NotificationChannel) {
  switch (channel) {
    case "email":
      return Mail
    case "whatsapp":
      return MessageCircle
    case "push":
      return Radio
    default:
      return MonitorSmartphone
  }
}

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

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [channel, setChannel] = useState<NotificationChannel | "all">("all")
  const [unread, setUnread] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationsApi.list({
        page: 1,
        page_size: 50,
        channel: channel === "all" ? undefined : channel,
      })
      setItems(res.items)
      setUnread(res.unread_count)
      setCounts(res.channel_counts)
      setError(null)
    } catch {
      setError("Could not load notification history.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [channel])

  useEffect(() => {
    void load()
  }, [load])

  const description = useMemo(() => {
    if (loading) return "Loading history…"
    return `${unread} unread in-app · ${items.length} shown`
  }, [loading, unread, items.length])

  async function markAllRead() {
    await notificationsApi.markAllRead()
    await load()
  }

  async function toggleRead(item: AppNotification) {
    await notificationsApi.markRead(item.id, !item.is_read)
    await load()
  }

  async function sendTest() {
    await notificationsApi.test({
      title: "Test notification",
      message: "HirePulse notification channels are working.",
      channels: ["in_app", "email", "push"],
    })
    await load()
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Notifications"
          description={description}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void sendTest()}>
                Send test
              </Button>
              <Button variant="outline" onClick={() => void markAllRead()}>
                <CheckCheck data-icon="inline-start" />
                Mark all read
              </Button>
            </div>
          }
        />
      </FadeIn>

      <FadeIn>
        <div className="flex flex-wrap gap-2">
          {channelTabs.map((tab) => {
            const Icon = tab.icon
            const count =
              tab.key === "all"
                ? Object.values(counts).reduce((a, b) => a + b, 0)
                : counts[tab.key] ?? 0
            return (
              <Button
                key={tab.key}
                variant={channel === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setChannel(tab.key)}
              >
                <Icon data-icon="inline-start" className="size-3.5" />
                {tab.label}
                {count > 0 ? (
                  <span className="ml-1 text-xs opacity-70">{count}</span>
                ) : null}
              </Button>
            )
          })}
        </div>
      </FadeIn>

      {error ? (
        <FadeIn>
          <Card className="border-destructive/40 bg-destructive/5 shadow-none">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        </FadeIn>
      ) : null}

      <div className="space-y-3">
        {!loading && items.length === 0 ? (
          <FadeIn>
            <Card className="border-border/70 bg-card/80 shadow-none">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No notifications yet. Hiring events and the test button will appear here.
              </CardContent>
            </Card>
          </FadeIn>
        ) : null}

        {items.map((item, index) => {
          const Icon = channelIcon(item.channel)
          const body = (
            <Card
              className={cn(
                "border-border/70 bg-card/80 shadow-none backdrop-blur transition-all duration-300 hover:border-primary/25",
                !item.is_read && item.channel === "in_app" && "bg-primary/5"
              )}
            >
              <CardContent className="flex items-start gap-3 p-4 sm:items-center">
                <span className="mt-0.5 rounded-xl bg-muted p-2 text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-sm font-semibold">{item.title}</h3>
                    <StatusBadge status={item.notification_type} />
                    <StatusBadge status={item.channel} />
                    <StatusBadge status={item.delivery_status} />
                    {!item.is_read && item.channel === "in_app" ? (
                      <span className="size-1.5 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                  <p className="text-xs text-muted-foreground">{formatWhen(item.created_at)}</p>
                </div>
                {item.channel === "in_app" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={(e) => {
                      e.preventDefault()
                      void toggleRead(item)
                    }}
                  >
                    {item.is_read ? "Mark unread" : "Mark read"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03, duration: 0.3 }}
            >
              {item.link ? (
                <Link href={item.link} className="block">
                  {body}
                </Link>
              ) : (
                body
              )}
            </motion.div>
          )
        })}
      </div>
    </PageTransition>
  )
}
