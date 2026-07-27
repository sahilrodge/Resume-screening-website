"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Bell, Search } from "lucide-react"

import { getNavMeta } from "@/config/navigation"
import { useAuth } from "@/features/auth/auth-provider"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { notificationsApi } from "@/services/notifications"

function initials(name?: string | null) {
  if (!name) return "HP"
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function AppNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const meta = getNavMeta(pathname, user?.role)
  const [unread, setUnread] = useState(0)
  const [search, setSearch] = useState("")

  const isCandidate = user?.role === "candidate"
  const settingsHref = isCandidate ? "/portal/settings" : "/settings"
  const profileHref = isCandidate ? "/portal/profile" : "/profile"
  const notificationsHref = isCandidate
    ? "/portal/notifications"
    : "/notifications"
  const searchPlaceholder = isCandidate
    ? "Search open jobs…"
    : "Search candidates or jobs…"

  useEffect(() => {
    if (!user) {
      setUnread(0)
      return
    }
    let cancelled = false
    const tick = () => {
      void notificationsApi
        .unreadCount()
        .then((res) => {
          if (!cancelled) setUnread(res.unread_count)
        })
        .catch(() => {
          if (!cancelled) setUnread(0)
        })
    }
    tick()
    const id = window.setInterval(tick, 30000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user, pathname])

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    const q = search.trim()
    if (!q) return
    if (isCandidate) {
      router.push(`/portal/jobs?q=${encodeURIComponent(q)}`)
    } else {
      router.push(`/candidates?q=${encodeURIComponent(q)}`)
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 hidden h-5 sm:block" />

        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-sm font-semibold tracking-tight md:text-base">
            {meta.title}
          </div>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {meta.description}
          </p>
        </div>

        <form
          onSubmit={onSearchSubmit}
          className="relative hidden w-full max-w-xs lg:block"
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 bg-muted/40 pl-8"
            aria-label="Search"
          />
        </form>

        <Link
          href={notificationsHref}
          className="relative inline-flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]">
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </Link>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-8">
              {user?.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user.full_name} />
              ) : null}
              <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                {initials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user?.full_name ?? "User"}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email ?? ""}
                </span>
                <span className="mt-1 text-[11px] font-medium tracking-wide text-primary uppercase">
                  {user?.role ?? ""}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(profileHref)}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(settingsHref)}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(notificationsHref)}>
              Notifications
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void logout()}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
