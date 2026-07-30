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
  "Under Review": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  screening: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  shortlisted: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Applied: "bg-primary/15 text-primary",
  applied: "bg-primary/15 text-primary",
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
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  Selected: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  selected: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
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
  // Interview statuses
  scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  confirmed: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  Confirmed: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  rescheduled: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  Rescheduled: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  in_progress: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  "In Progress": "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
  Cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-purple-500/15 text-purple-800 dark:text-purple-300",
  "No Show": "bg-purple-500/15 text-purple-800 dark:text-purple-300",
  no_answer: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  busy: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  in_app: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  email: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  push: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  skipped: "bg-muted text-muted-foreground",
  phone: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  video: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  onsite: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
}

const labelOverrides: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  in_progress: "In Progress",
  completed: "Completed",
  selected: "Selected",
  rejected: "Rejected",
  hired: "Hired",
  screening: "Under Review",
  shortlisted: "Shortlisted",
  applied: "Applied",
  cancelled: "Cancelled",
  no_show: "No Show",
  phone: "Phone",
  video: "Video",
  onsite: "Onsite",
}

function formatStatusLabel(status: string) {
  if (labelOverrides[status]) return labelOverrides[status]
  if (labelOverrides[status.toLowerCase()]) return labelOverrides[status.toLowerCase()]
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StatusBadge({ status }: { status?: string | null }) {
  const raw = status?.trim() || "Unknown"
  const label = formatStatusLabel(raw)
  const tone = toneMap[raw] ?? toneMap[label] ?? "bg-muted text-muted-foreground"
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", tone)}
    >
      {label}
    </Badge>
  )
}
