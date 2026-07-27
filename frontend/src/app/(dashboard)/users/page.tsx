"use client"

import { useCallback, useEffect, useState } from "react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usersApi } from "@/services/users"
import type { User, UserRole } from "@/types/auth"
import { ApiError } from "@/types/api"

const roleFilters: { label: string; value: UserRole | "" }[] = [
  { label: "All roles", value: "" },
  { label: "Admin", value: "admin" },
  { label: "Recruiter", value: "recruiter" },
  { label: "Candidate", value: "candidate" },
]

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<UserRole | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("recruiter")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await usersApi.list({
      page: 1,
      page_size: 50,
      search: search || undefined,
      role: role || undefined,
    })
    setItems(res.items)
    setTotal(res.total)
  }, [search, role])

  useEffect(() => {
    let cancelled = false
    const handle = window.setTimeout(() => {
      setLoading(true)
      load()
        .then(() => {
          if (!cancelled) setError(null)
        })
        .catch(() => {
          if (!cancelled) setError("Could not load users.")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [load])

  async function inviteUser(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await usersApi.create({
        email,
        password,
        full_name: fullName,
        role: inviteRole,
      })
      setInviteOpen(false)
      setFullName("")
      setEmail("")
      setPassword("")
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user.")
    }
  }

  async function toggleActive(user: User) {
    setBusyId(user.id)
    setError(null)
    try {
      await usersApi.update(user.id, { is_active: !user.is_active })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Users"
          description="All platform accounts across admin, recruiter, and candidate roles."
          actions={
            <Button onClick={() => setInviteOpen((v) => !v)}>Invite user</Button>
          }
        />
      </FadeIn>

      {inviteOpen ? (
        <FadeIn>
          <form
            onSubmit={inviteUser}
            className="mb-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-5"
          >
            <div className="space-y-1">
              <Label htmlFor="user_name">Full name</Label>
              <Input
                id="user_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user_email">Email</Label>
              <Input
                id="user_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user_password">Temp password</Label>
              <Input
                id="user_password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user_role">Role</Label>
              <select
                id="user_role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="admin">Admin</option>
                <option value="recruiter">Recruiter</option>
                <option value="candidate">Candidate</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Create
              </Button>
            </div>
          </form>
        </FadeIn>
      ) : null}

      <FadeIn>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="max-w-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole | "")}
            className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {roleFilters.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">{total} users</p>
        </div>
      </FadeIn>

      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <FadeIn>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : null}
              {items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="capitalize">{user.role}</TableCell>
                  <TableCell>{user.is_active ? "Active" : "Inactive"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === user.id}
                      onClick={() => void toggleActive(user)}
                    >
                      {user.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </FadeIn>
    </PageTransition>
  )
}
