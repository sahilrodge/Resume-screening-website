"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import Link from "next/link"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
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
import { CandidateFormDialog } from "@/features/candidates/candidate-form-dialog"
import {
  toCreatePayload,
  toUpdatePayload,
  type CandidateCreateValues,
  type CandidateUpdateValues,
} from "@/features/candidates/schemas"
import { useApiLoading } from "@/hooks/use-api-loading"
import { candidatesApi } from "@/services/candidates"
import { ApiError } from "@/types/api"
import type {
  Candidate,
  CandidateSortField,
  SortOrder,
} from "@/types/candidate"

const sortOptions: { label: string; value: CandidateSortField }[] = [
  { label: "Created", value: "created_at" },
  { label: "Name", value: "full_name" },
  { label: "Email", value: "email" },
  { label: "Experience", value: "years_experience" },
  { label: "Location", value: "location" },
  { label: "Title", value: "current_title" },
]

export default function CandidatesPage() {
  const { loading } = useApiLoading()
  const [items, setItems] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [location, setLocation] = useState("")
  const [minExperience, setMinExperience] = useState("")
  const [maxExperience, setMaxExperience] = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">(
    "all"
  )
  const [sortBy, setSortBy] = useState<CandidateSortField>("created_at")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")
    if (q) {
      setSearch(q)
      setDebouncedSearch(q)
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
        const data = await candidatesApi.list({
          page,
          page_size: pageSize,
          search: debouncedSearch || undefined,
          location: location.trim() || undefined,
          min_experience: minExperience ? Number(minExperience) : undefined,
          max_experience: maxExperience ? Number(maxExperience) : undefined,
          is_active:
            activeFilter === "all" ? undefined : activeFilter === "active",
          sort_by: sortBy,
          sort_order: sortOrder,
        })
        if (cancelled) return
        setItems(data.items)
        setTotal(data.total)
        setPages(data.pages)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load candidates"
          )
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
    minExperience,
    maxExperience,
    activeFilter,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    setPage(1)
  }, [
    debouncedSearch,
    location,
    minExperience,
    maxExperience,
    activeFilter,
    sortBy,
    sortOrder,
  ])

  const fetchCandidates = useCallback(async () => {
    setError(null)
    try {
      const data = await candidatesApi.list({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        location: location.trim() || undefined,
        min_experience: minExperience ? Number(minExperience) : undefined,
        max_experience: maxExperience ? Number(maxExperience) : undefined,
        is_active:
          activeFilter === "all" ? undefined : activeFilter === "active",
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      setItems(data.items)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load candidates")
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    location,
    minExperience,
    maxExperience,
    activeFilter,
    sortBy,
    sortOrder,
  ])

  function openCreate() {
    setDialogMode("create")
    setSelected(null)
    setDialogOpen(true)
  }

  function openEdit(candidate: Candidate) {
    setDialogMode("edit")
    setSelected(candidate)
    setDialogOpen(true)
  }

  async function handleCreate(values: CandidateCreateValues) {
    setSubmitting(true)
    setError(null)
    try {
      await candidatesApi.create(toCreatePayload(values))
      setDialogOpen(false)
      await fetchCandidates()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(values: CandidateUpdateValues) {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      await candidatesApi.update(selected.id, toUpdatePayload(values))
      setDialogOpen(false)
      await fetchCandidates()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(candidate: Candidate) {
    const ok = window.confirm(`Delete candidate "${candidate.full_name}"?`)
    if (!ok) return
    setError(null)
    try {
      await candidatesApi.remove(candidate.id)
      await fetchCandidates()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed")
    }
  }

  function toggleSort(field: CandidateSortField) {
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
          title="Candidates"
          description="Create, search, filter, and manage candidate profiles."
          actions={
            <>
              <Button variant="outline" onClick={() => void fetchCandidates()}>
                <RefreshCw data-icon="inline-start" />
                Refresh
              </Button>
              <Button onClick={openCreate}>
                <Plus data-icon="inline-start" />
                Add candidate
              </Button>
            </>
          }
        />
      </FadeIn>

      {error ? (
        <FadeIn>
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        </FadeIn>
      ) : null}

      <FadeIn>
        <AdminTableShell
          title={`${total} candidates`}
          description="Live data from FastAPI · search, filters, sort, pagination"
          toolbar={
            <div className="grid w-full gap-3 lg:grid-cols-6">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, title..."
                className="lg:col-span-2"
              />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Filter location"
              />
              <Input
                type="number"
                min={0}
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                placeholder="Min years"
              />
              <Input
                type="number"
                min={0}
                value={maxExperience}
                onChange={(e) => setMaxExperience(e.target.value)}
                placeholder="Max years"
              />
              <select
                value={activeFilter}
                onChange={(e) =>
                  setActiveFilter(e.target.value as "all" | "active" | "inactive")
                }
                className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div className="flex items-center gap-2 lg:col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as CandidateSortField)}
                  className="flex h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Sort: {opt.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                  }
                  aria-label="Toggle sort order"
                >
                  <ArrowDownUp className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground uppercase">
                  {sortOrder}
                </span>
              </div>
            </div>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="font-medium"
                    onClick={() => toggleSort("full_name")}
                  >
                    Name
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <button
                    type="button"
                    className="font-medium"
                    onClick={() => toggleSort("current_title")}
                  >
                    Title
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button
                    type="button"
                    className="font-medium"
                    onClick={() => toggleSort("location")}
                  >
                    Location
                  </button>
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  <button
                    type="button"
                    className="font-medium"
                    onClick={() => toggleSort("years_experience")}
                  >
                    Exp
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {loading ? "Loading candidates..." : "No candidates found"}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                    <TableCell>
                      <Link href={`/candidates/${row.id}`} className="block hover:underline">
                        <div className="font-medium">{row.full_name}</div>
                        <div className="text-xs text-muted-foreground">{row.email}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div>{row.current_title || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.headline || "No headline"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {row.location || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {row.years_experience ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.is_active ? "Active" : "Inactive"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/candidates/${row.id}`}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          aria-label="View profile"
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

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {Math.max(pages, 1)} · {total} total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft data-icon="inline-start" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pages === 0 || page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </AdminTableShell>
      </FadeIn>

      <CandidateFormDialog
        open={dialogOpen}
        mode={dialogMode}
        candidate={selected}
        submitting={submitting}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </PageTransition>
  )
}
