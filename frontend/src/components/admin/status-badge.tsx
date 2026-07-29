import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const toneMap: Record<string, string> = {
  Open: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Hired: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  parsed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Shortlisted: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Interview: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  parsing: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Screening: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Trial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Away: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Draft: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  uploaded: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  New: "bg-primary/15 text-primary",
  Closed: "bg-muted text-muted-foreground",
  Filled: "bg-muted text-muted-foreground",
  Inactive: "bg-muted text-muted-foreground",
  Paused: "bg-muted text-muted-foreground",
  Rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  alert: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  sent: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  read: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  queued: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  inbound: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  outbound: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  initiated: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ringing: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  in_progress: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  no_answer: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  busy: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelled: "bg-muted text-muted-foreground",
  in_app: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  email: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  push: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  skipped: "bg-muted text-muted-foreground",
}

export function StatusBadge({ status }: { status?: string | null }) {
  const label = status?.trim() || "Unknown"
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", toneMap[label] ?? "bg-muted")}
    >
      {label}
    </Badge>
  )
}
