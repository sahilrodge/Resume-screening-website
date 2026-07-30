"use client"

import { StatusBadge } from "@/components/admin/status-badge"
import { applicationStatusLabel } from "@/lib/application-status"

/** Colored application status badge — always uses the shared label map. */
export function ApplicationStatusBadge({
  status,
}: {
  status?: string | null
}) {
  return <StatusBadge status={applicationStatusLabel(status)} />
}
