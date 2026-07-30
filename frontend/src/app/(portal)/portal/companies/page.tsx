"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2 } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { buttonVariants } from "@/components/ui/button"
import { companiesApi } from "@/services/companies"
import { ApiError } from "@/types/api"
import type { Company } from "@/types/company"

export default function PortalCompaniesPage() {
  const [items, setItems] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void companiesApi
      .list(50)
      .then((res) => {
        if (!cancelled) {
          setItems(res.items ?? [])
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setItems([])
          setError(
            err instanceof ApiError ? err.message : "Could not load companies"
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Companies"
        description="Browse hiring companies and open roles."
        actions={
          <Link href="/portal/jobs" className={buttonVariants({ variant: "outline" })}>
            Browse jobs
          </Link>
        }
      />

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {loading ? <PageSkeleton withHeader={false} rows={4} /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Companies appear here when recruiters publish open roles."
          action={
            <Link href="/portal/jobs" className={buttonVariants()}>
              View jobs
            </Link>
          }
        />
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border/70">
        {items.map((company) => (
          <li key={company.id}>
            <Link
              href={`/portal/companies/${company.id}`}
              className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{company.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[company.industry, company.location].filter(Boolean).join(" · ") ||
                    "Company profile"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-primary">View</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
