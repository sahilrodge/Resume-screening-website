"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
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
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

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
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | JobStatus)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="filled">Filled</option>
              </select>
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as "all" | EmploymentType)
                }
              >
                <option value="all">All types</option>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
                <option value="remote">Remote</option>
              </select>
            </div>
          }
        >
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
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {loading ? "Loading jobs..." : "No jobs found"}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
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
                      {row.company_name || "—"}
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
                ))
              )}
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
