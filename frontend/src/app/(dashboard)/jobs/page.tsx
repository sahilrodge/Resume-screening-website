"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { EmptyState } from "@/components/shared/empty-state"
import { InlineAlert } from "@/components/shared/inline-alert"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/page-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { JobFormDialog } from "@/features/jobs/job-form-dialog"
import {
  toCreatePayload,
  toUpdatePayload,
  type JobCreateValues,
  type JobUpdateValues,
} from "@/features/jobs/schemas"
import { useApiLoading } from "@/hooks/use-api-loading"
import { jobsApi } from "@/services/jobs"
import { ApiError } from "@/types/api"
import type {
  EmploymentType,
  Job,
  JobDashboardStats,
  JobSortField,
  JobStatus,
  SortOrder,
} from "@/types/job"
import { EMPLOYMENT_TYPE_LABELS, JOB_STATUS_LABELS } from "@/types/job"

export default function JobsPage() {
  const { loading } = useApiLoading()
  const [items, setItems] = useState<Job[]>([])
  const [stats, setStats] = useState<JobDashboardStats | null>(null)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [location, setLocation] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all")
  const [typeFilter, setTypeFilter] = useState<"all" | EmploymentType>("all")
  const [sortBy, setSortBy] = useState<JobSortField>("created_at")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selected, setSelected] = useState<Job | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")
    if (q) {
      setSearch(q)
      setDebouncedSearch(q.trim())
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setError(null)
      try {
        const [data, dash] = await Promise.all([
          jobsApi.list({
            page,
            page_size: pageSize,
            search: debouncedSearch || undefined,
            location: location.trim() || undefined,
            status: statusFilter === "all" ? undefined : statusFilter,
            employment_type: typeFilter === "all" ? undefined : typeFilter,
            sort_by: sortBy,
            sort_order: sortOrder,
          }),
          jobsApi.dashboardStats(),
        ])
        if (cancelled) return
        setItems(data.items)
        setTotal(data.total)
        setPages(data.pages)
        setStats(dash)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load jobs")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    location,
    statusFilter,
    typeFilter,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, location, statusFilter, typeFilter, sortBy, sortOrder])

  const fetchJobs = useCallback(async () => {
    setError(null)
    try {
      const [data, dash] = await Promise.all([
        jobsApi.list({
          page,
          page_size: pageSize,
          search: debouncedSearch || undefined,
          location: location.trim() || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          employment_type: typeFilter === "all" ? undefined : typeFilter,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        jobsApi.dashboardStats(),
      ])
      setItems(data.items)
      setTotal(data.total)
      setPages(data.pages)
      setStats(dash)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load jobs")
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    location,
    statusFilter,
    typeFilter,
    sortBy,
    sortOrder,
  ])

  function openCreate() {
    setDialogMode("create")
    setSelected(null)
    setDialogOpen(true)
  }

  function openEdit(job: Job) {
    setDialogMode("edit")
    setSelected(job)
    setDialogOpen(true)
  }

  async function handleCreate(values: JobCreateValues) {
    setSubmitting(true)
    setError(null)
    try {
      await jobsApi.create(toCreatePayload(values))
      setDialogOpen(false)
      await fetchJobs()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(values: JobUpdateValues) {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      await jobsApi.update(selected.id, toUpdatePayload(values))
      setDialogOpen(false)
      await fetchJobs()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(job: Job) {
    const ok = window.confirm(`Delete job "${job.title}"?`)
    if (!ok) return
    setError(null)
    try {
      await jobsApi.remove(job.id)
      await fetchJobs()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed")
    }
  }

  function toggleSort(field: JobSortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Jobs"
          description="Create, search, filter, and manage open roles. Track applications and status."
          actions={
            <>
              <Button variant="outline" onClick={() => void fetchJobs()}>
                <RefreshCw data-icon="inline-start" />
                Refresh
              </Button>
              <Button onClick={openCreate}>
                <Plus data-icon="inline-start" />
                Create job
              </Button>
            </>
          }
        />
      </FadeIn>

      {stats ? (
        <FadeIn>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Total jobs", value: stats.total_jobs },
              { label: "Open", value: stats.open_jobs },
              { label: "Draft", value: stats.draft_jobs },
              { label: "Closed", value: stats.closed_jobs },
              { label: "Filled", value: stats.filled_jobs },
              { label: "Applications", value: stats.total_applications },
            ].map((item) => (
              <div key={item.label} className="space-y-1 border-b border-border/60 pb-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="font-heading text-2xl font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      ) : null}

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      <FadeIn>
        <AdminTableShell
          title={`${total} jobs`}
          description="Search by title/company and filter by status or employment type."
          toolbar={
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <Input
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="lg:max-w-xs"
              />
              <Input
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="lg:max-w-[10rem]"
              />
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter((value ?? "all") as "all" | JobStatus)
                }
              >
                <SelectTrigger className="w-full sm:w-[9.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={(value) =>
                  setTypeFilter((value ?? "all") as "all" | EmploymentType)
                }
              >
                <SelectTrigger className="w-full sm:w-[9.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
          {loading && items.length === 0 ? (
            <TableSkeleton cols={6} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs found"
              description="Try adjusting filters, or create a new role to get started."
              action={
                <Button onClick={openCreate}>
                  <Plus data-icon="inline-start" />
                  Create job
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button type="button" className="font-medium" onClick={() => toggleSort("title")}>
                        Role
                      </button>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Company</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      <button
                        type="button"
                        className="font-medium"
                        onClick={() => toggleSort("employment_type")}
                      >
                        Type
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium"
                        onClick={() => toggleSort("application_count")}
                      >
                        Applicants
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium"
                        onClick={() => toggleSort("status")}
                      >
                        Status
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                      <TableCell>
                        <Link href={`/jobs/${row.id}`} className="block hover:underline">
                          <div className="font-medium">{row.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.location || "Remote / n/a"} · {row.openings} opening
                            {row.openings === 1 ? "" : "s"}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {row.company_id ? (
                          <Link
                            href={`/companies/${row.company_id}`}
                            className="hover:underline"
                          >
                            {row.company_name || "—"}
                          </Link>
                        ) : (
                          row.company_name || "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline">
                          {EMPLOYMENT_TYPE_LABELS[row.employment_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {row.application_count}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={JOB_STATUS_LABELS[row.status]} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/jobs/${row.id}`}
                            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            aria-label="View details"
                          >
                            <Eye />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(row)}
                            aria-label="Edit"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => void handleDelete(row)}
                            aria-label="Delete"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {pages || 1}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </AdminTableShell>
      </FadeIn>

      <JobFormDialog
        open={dialogOpen}
        mode={dialogMode}
        job={selected}
        submitting={submitting}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </PageTransition>
  )
}
