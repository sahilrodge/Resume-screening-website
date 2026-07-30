"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react"
import { Bell, Bookmark, Briefcase, CheckCheck, FileText, Loader2, LogOut, Search, Settings, Trash2, UserRound } from "lucide-react"

import { getNavMeta } from "@/config/navigation"
import { useAuth } from "@/features/auth/auth-provider"
import { useCandidateSyncOptional } from "@/features/candidate/candidate-sync-provider"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { jobsApi } from "@/services/jobs"
import { notificationsApi } from "@/services/notifications"
import type { Job } from "@/types/job"
import type { AppNotification } from "@/types/notification"

function initials(name?: string | null) {
  if (!name) return "HP"
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatRelativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ""
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function jobMatchesSkills(job: Job, q: string) {
  return (job.skills ?? []).some((skill) =>
    skill.toLowerCase().includes(q.toLowerCase())
  )
}

export function AppNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const candidateSync = useCandidateSyncOptional()
  const meta = getNavMeta(pathname, user?.role)
  const searchListId = useId()
  const mobileSearchListId = useId()

  const [unread, setUnread] = useState(0)
  const [search, setSearch] = useState("")
  const [suggestions, setSuggestions] = useState<Job[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const searchWrapRef = useRef<HTMLDivElement>(null)
  const mobileSearchWrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)
  const searchSeq = useRef(0)

  const isCandidate = user?.role === "candidate"
  const settingsHref = isCandidate ? "/portal/settings" : "/settings"
  const profileHref = isCandidate ? "/portal/profile" : "/profile"
  const resumeHref = isCandidate ? "/portal/screening" : "/resumes"
  const savedJobsHref = "/portal/saved-jobs"
  const notificationsHref = isCandidate
    ? "/portal/notifications"
    : "/notifications"
  const jobsHref = isCandidate ? "/portal/jobs" : "/jobs"
  const [loggingOut, setLoggingOut] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const syncedUnread = candidateSync?.unreadCount
  const syncedSavedCount = candidateSync?.savedJobsTotal
  const displayUnread = syncedUnread ?? unread
  const savedJobsCount = syncedSavedCount ?? 0

  const refreshUnread = useCallback(() => {
    if (candidateSync) {
      // Unread count comes from CandidateSyncProvider overview
      return
    }
    if (!user) {
      setUnread(0)
      return
    }
    void notificationsApi
      .unreadCount()
      .then((res) => setUnread(res.unread_count))
      .catch(() => setUnread(0))
  }, [user, candidateSync])

  useEffect(() => {
    refreshUnread()
    if (!user || candidateSync) return
    const id = window.setInterval(refreshUnread, 30000)
    return () => window.clearInterval(id)
  }, [user, pathname, refreshUnread, candidateSync])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        !searchWrapRef.current?.contains(target) &&
        !mobileSearchWrapRef.current?.contains(target)
      ) {
        setSearchOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  useEffect(() => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current)
    }

    const q = search.trim()
    if (q.length < 2) {
      setSuggestions([])
      setSearchLoading(false)
      setSearchError(null)
      setActiveIndex(-1)
      return
    }

    setSearchLoading(true)
    setSearchError(null)
    const seq = ++searchSeq.current

    debounceRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const res = isCandidate
            ? await jobsApi.listOpen({
                search: q,
                page: 1,
                page_size: 8,
              })
            : await jobsApi.list({
                search: q,
                page: 1,
                page_size: 8,
              })
          if (seq !== searchSeq.current) return
          // Prefer API matches; also keep any skill hits the API may surface.
          const items = res.items.filter(
            (job) =>
              job.title.toLowerCase().includes(q.toLowerCase()) ||
              (job.company_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
              (job.location ?? "").toLowerCase().includes(q.toLowerCase()) ||
              (job.description ?? "").toLowerCase().includes(q.toLowerCase()) ||
              jobMatchesSkills(job, q)
          )
          setSuggestions(items.length ? items : res.items)
          setSearchOpen(true)
          setActiveIndex(-1)
        } catch {
          if (seq !== searchSeq.current) return
          setSuggestions([])
          setSearchError("Could not search jobs.")
          setSearchOpen(true)
        } finally {
          if (seq === searchSeq.current) setSearchLoading(false)
        }
      })()
    }, 280)

    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [search, isCandidate])

  function goToJobsSearch(q: string) {
    const trimmed = q.trim()
    setSearchOpen(false)
    setActiveIndex(-1)
    if (!trimmed) {
      router.push(jobsHref)
      return
    }
    router.push(`${jobsHref}?q=${encodeURIComponent(trimmed)}`)
  }

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      openJob(suggestions[activeIndex])
      return
    }
    goToJobsSearch(search)
  }

  function openJob(job: Job) {
    setSearchOpen(false)
    setSearch("")
    setSuggestions([])
    if (isCandidate) {
      router.push(`/portal/jobs?q=${encodeURIComponent(job.title)}`)
    } else {
      router.push(`/jobs/${job.id}`)
    }
  }

  async function loadNotifications() {
    if (!user) return
    if (candidateSync) {
      setNotifications(candidateSync.notifications.slice(0, 12))
      setNotifError(null)
      setNotifLoading(false)
      void candidateSync.refresh({ silent: true })
      return
    }
    setNotifLoading(true)
    setNotifError(null)
    try {
      const res = await notificationsApi.list({
        page: 1,
        page_size: 12,
        channel: "in_app",
      })
      setNotifications(res.items)
      setUnread(res.unread_count)
    } catch {
      setNotifError("Could not load notifications.")
      setNotifications([])
    } finally {
      setNotifLoading(false)
    }
  }

  async function onMarkRead(id: string) {
    try {
      await notificationsApi.markRead(id, true)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      if (candidateSync) {
        candidateSync.setNotifications(
          candidateSync.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          )
        )
        candidateSync.setUnreadCount(Math.max(0, candidateSync.unreadCount - 1))
      } else {
        refreshUnread()
      }
    } catch {
      setNotifError("Could not mark as read.")
    }
  }

  async function onMarkAllRead() {
    try {
      const res = await notificationsApi.markAllRead()
      setUnread(res.unread_count)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      if (candidateSync) {
        candidateSync.setUnreadCount(res.unread_count)
        candidateSync.setNotifications(
          candidateSync.notifications.map((n) => ({ ...n, is_read: true }))
        )
      }
    } catch {
      setNotifError("Could not mark all as read.")
    }
  }

  async function onClearAll() {
    try {
      const res = await notificationsApi.clearAll()
      setUnread(res.unread_count)
      setNotifications([])
      if (candidateSync) {
        candidateSync.setUnreadCount(0)
        candidateSync.setNotifications([])
      }
    } catch {
      setNotifError("Could not clear notifications.")
    }
  }

  function onNotificationClick(item: AppNotification) {
    if (!item.is_read) {
      void onMarkRead(item.id)
    }
    if (item.link) {
      startTransition(() => {
        router.push(item.link!)
      })
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

        <div
          ref={searchWrapRef}
          className="relative hidden w-full max-w-sm md:block"
        >
          <form onSubmit={onSearchSubmit} className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => {
                if (search.trim().length >= 2 || suggestions.length) {
                  setSearchOpen(true)
                }
              }}
              onKeyDown={(e) => {
                if (!searchOpen || suggestions.length === 0) return
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setActiveIndex((i) =>
                    i < suggestions.length - 1 ? i + 1 : 0
                  )
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setActiveIndex((i) =>
                    i <= 0 ? suggestions.length - 1 : i - 1
                  )
                } else if (e.key === "Escape") {
                  setSearchOpen(false)
                  setActiveIndex(-1)
                }
              }}
              placeholder="Search jobs by title, company, location, skills…"
              className="h-8 bg-muted/40 pl-8 pr-8"
              aria-label="Search jobs"
              aria-autocomplete="list"
              aria-controls={searchListId}
              aria-expanded={searchOpen}
              role="combobox"
            />
            {searchLoading ? (
              <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </form>

          {searchOpen && search.trim().length >= 2 ? (
            <div
              id={searchListId}
              role="listbox"
              className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
            >
              {searchError ? (
                <p className="px-3 py-3 text-sm text-destructive">{searchError}</p>
              ) : null}
              {!searchError && !searchLoading && suggestions.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  No matching jobs.
                </p>
              ) : null}
              <ul className="max-h-80 overflow-y-auto py-1">
                {suggestions.map((job, index) => (
                  <li key={job.id} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        index === activeIndex && "bg-accent"
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openJob(job)}
                    >
                      <Briefcase className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {job.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[job.company_name, job.location]
                            .filter(Boolean)
                            .join(" · ") || "Open role"}
                          {job.skills?.length
                            ? ` · ${job.skills.slice(0, 3).join(", ")}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-2 py-1.5">
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:bg-accent"
                  onClick={() => goToJobsSearch(search)}
                >
                  View all results for “{search.trim()}”
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <DropdownMenu
          onOpenChange={(open) => {
            if (open) void loadNotifications()
          }}
        >
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "relative"
            )}
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {displayUnread > 0 ? (
              <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]">
                {displayUnread > 99 ? "99+" : displayUnread}
              </Badge>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[min(22rem,calc(100vw-1.5rem))] p-0"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {displayUnread > 0 ? `${displayUnread} unread` : "You are all caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Mark all as read"
                  title="Mark all as read"
                  disabled={displayUnread === 0}
                  onClick={() => void onMarkAllRead()}
                >
                  <CheckCheck className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear notifications"
                  title="Clear notifications"
                  disabled={notifications.length === 0}
                  onClick={() => void onClearAll()}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifLoading ? (
                <div className="space-y-2 px-3 py-3" aria-busy="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1.5 rounded-lg border border-border/50 p-2.5">
                      <div className="flex justify-between gap-2">
                        <Skeleton className="h-3.5 w-36" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  ))}
                </div>
              ) : null}
              {notifError ? (
                <p className="px-3 py-3 text-sm text-destructive">{notifError}</p>
              ) : null}
              {!notifLoading && !notifError && notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : null}
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border/70 px-3 py-2.5 text-left last:border-b-0",
                    !item.is_read && "bg-primary/5"
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 rounded-md text-left transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={() => onNotificationClick(item)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-snug">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {item.message}
                    </span>
                  </button>
                  {!item.is_read ? (
                    <button
                      type="button"
                      className="mt-1 self-start text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      onClick={() => void onMarkRead(item.id)}
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="border-t border-border p-1.5">
              <DropdownMenuItem
                className="justify-center"
                onClick={() => router.push(notificationsHref)}
              >
                View all notifications
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground"
            )}
            aria-label="Open account menu"
            aria-haspopup="menu"
          >
            <Avatar className="size-8 ring-1 ring-border/80">
              {user?.avatar_url ? (
                <AvatarImage
                  src={user.avatar_url}
                  alt={user.full_name || "Account"}
                />
              ) : null}
              <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                {initials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-[min(17.5rem,calc(100vw-1.25rem))] border-border/70 bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-md origin-top-right duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {/* Plain header — Base UI GroupLabel must live inside Menu.Group */}
            <div className="flex items-center gap-3 px-2.5 py-2.5">
              <Avatar className="size-9 shrink-0 ring-1 ring-border/70">
                {user?.avatar_url ? (
                  <AvatarImage
                    src={user.avatar_url}
                    alt={user.full_name || "Account"}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                  {initials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.full_name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email ?? ""}
                </p>
                {user?.role ? (
                  <p className="mt-0.5 text-[11px] font-medium tracking-wide text-primary uppercase">
                    {user.role}
                  </p>
                ) : null}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2.5 py-2"
              onClick={() => {
                setAccountOpen(false)
                router.push(profileHref)
              }}
            >
              <UserRound className="size-4 text-muted-foreground" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2.5 py-2"
              onClick={() => {
                setAccountOpen(false)
                router.push(resumeHref)
              }}
            >
              <FileText className="size-4 text-muted-foreground" />
              Resume
            </DropdownMenuItem>
            {isCandidate ? (
              <DropdownMenuItem
                className="cursor-pointer gap-2.5 py-2"
                onClick={() => {
                  setAccountOpen(false)
                  router.push(savedJobsHref)
                }}
              >
                <Bookmark className="size-4 text-muted-foreground" />
                <span className="flex-1">Saved Jobs</span>
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums"
                >
                  {savedJobsCount}
                </Badge>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className="cursor-pointer gap-2.5 py-2"
              onClick={() => {
                setAccountOpen(false)
                router.push(settingsHref)
              }}
            >
              <Settings className="size-4 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer gap-2.5 py-2"
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true)
                setAccountOpen(false)
                void logout().finally(() => setLoggingOut(false))
              }}
            >
              <LogOut className="size-4" />
              {loggingOut ? "Signing out…" : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Compact search for small screens */}
      <div className="border-t border-border/60 px-4 py-2 md:hidden">
        <div className="relative" ref={mobileSearchWrapRef}>
          <form onSubmit={onSearchSubmit} className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => {
                if (search.trim().length >= 2 || suggestions.length) {
                  setSearchOpen(true)
                }
              }}
              placeholder="Search jobs…"
              className="h-8 bg-muted/40 pl-8"
              aria-label="Search jobs"
              aria-autocomplete="list"
              aria-controls={mobileSearchListId}
              aria-expanded={searchOpen}
              role="combobox"
            />
          </form>
          {searchOpen && search.trim().length >= 2 ? (
            <div
              id={mobileSearchListId}
              role="listbox"
              className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
            >
              {searchLoading ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
              ) : null}
              {!searchLoading && suggestions.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  No matching jobs.
                </p>
              ) : null}
              <ul className="max-h-64 overflow-y-auto py-1">
                {suggestions.map((job) => (
                  <li key={job.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                      onClick={() => openJob(job)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{job.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[job.company_name, job.location].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
