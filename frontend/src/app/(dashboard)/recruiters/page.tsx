"use client"

import { useEffect, useMemo, useState } from "react"
import { UserRoundPlus } from "lucide-react"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { DataToolbar } from "@/components/admin/data-toolbar"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { analyticsApi } from "@/services/analytics"
import { usersApi, type AdminUser } from "@/services/users"
import type { RecruiterPerformanceItem } from "@/types/analytics"
import { ApiError } from "@/types/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type RecruiterRow = {
  id: string
  name: string
  email: string
  openJobs: number
  hires: number
  applications: number
  status: "Active" | "Inactive"
}

export default function RecruitersPage() {
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<RecruiterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviting, setInviting] = useState(false)

  async function load() {
    const [usersRes, analytics] = await Promise.all([
      usersApi.list({ role: "recruiter", page_size: 100 }),
      analyticsApi.overview().catch(() => null),
    ])
    const perfByUserId = new Map<string, RecruiterPerformanceItem>()
    for (const item of analytics?.recruiter_performance ?? []) {
      if (item.user_id) perfByUserId.set(item.user_id, item)
    }
    const mapped: RecruiterRow[] = usersRes.items.map((user: AdminUser) => {
      const perf = perfByUserId.get(user.id)
      return {
        id: user.id,
        name: user.full_name,
        email: user.email,
        openJobs: perf?.open_jobs ?? 0,
        hires: perf?.hires ?? 0,
        applications: perf?.applications ?? 0,
        status: user.is_active ? "Active" : "Inactive",
      }
    })
    setRows(mapped)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .then(() => {
        if (!cancelled) setError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load recruiters.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    )
  }, [query, rows])

  async function inviteRecruiter(event: React.FormEvent) {
    event.preventDefault()
    setInviting(true)
    setError(null)
    try {
      await usersApi.create({
        email,
        password,
        full_name: fullName,
        role: "recruiter",
      })
      setInviteOpen(false)
      setFullName("")
      setEmail("")
      setPassword("")
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invite failed.")
    } finally {
      setInviting(false)
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Recruiters"
          description="Track recruiter capacity, hires, and account status."
          actions={
            <Button onClick={() => setInviteOpen((v) => !v)}>
              <UserRoundPlus data-icon="inline-start" />
              Invite recruiter
            </Button>
          }
        />
      </FadeIn>

      {inviteOpen ? (
        <FadeIn>
          <form
            onSubmit={inviteRecruiter}
            className="mb-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="invite_name">Full name</Label>
              <Input
                id="invite_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite_email">Email</Label>
              <Input
                id="invite_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite_password">Temp password</Label>
              <Input
                id="invite_password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviting} className="w-full">
                {inviting ? "Creating…" : "Create account"}
              </Button>
            </div>
          </form>
        </FadeIn>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <FadeIn>
        <AdminTableShell
          title={`${filtered.length} recruiters`}
          description="Live accounts with hiring performance from analytics."
          toolbar={
            <DataToolbar
              placeholder="Search recruiter..."
              value={query}
              onChange={setQuery}
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recruiter</TableHead>
                <TableHead>Open jobs</TableHead>
                <TableHead className="hidden sm:table-cell">Applications</TableHead>
                <TableHead className="hidden sm:table-cell">Hires</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No recruiters found.
                  </TableCell>
                </TableRow>
              ) : null}
              {filtered.map((row) => (
                <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </TableCell>
                  <TableCell>{row.openJobs}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {row.applications}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{row.hires}</TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableShell>
      </FadeIn>
    </PageTransition>
  )
}
