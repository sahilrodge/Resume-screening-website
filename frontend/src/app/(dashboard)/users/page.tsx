"use client"

import { useCallback, useEffect, useState } from "react"
import {
  KeyRound,
  Pencil,
  RefreshCw,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react"

import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { useAuth } from "@/features/auth/auth-provider"
import { usersApi, type AdminUser } from "@/services/users"
import type { UserRole } from "@/types/auth"
import { ApiError } from "@/types/api"

const PAGE_SIZE = 10

const roleFilters: { label: string; value: "all" | UserRole }[] = [
  { label: "All roles", value: "all" },
  { label: "Admin", value: "admin" },
  { label: "Recruiter", value: "recruiter" },
  { label: "Candidate", value: "candidate" },
]

const statusFilters = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
] as const

function formatDate(value?: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<UserRole | "">("")
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("recruiter")
  const [inviteCompany, setInviteCompany] = useState("")

  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editRole, setEditRole] = useState<UserRole>("candidate")
  const [editCompany, setEditCompany] = useState("")

  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const load = useCallback(async () => {
    const res = await usersApi.list({
      page,
      page_size: PAGE_SIZE,
      search: search.trim() || undefined,
      role: role || undefined,
      status: status === "all" ? undefined : status,
    })
    setItems(res.items)
    setTotal(res.total)
    setPages(res.pages)
  }, [page, search, role, status])

  useEffect(() => {
    let cancelled = false
    const handle = window.setTimeout(() => {
      setLoading(true)
      load()
        .then(() => {
          if (!cancelled) setError(null)
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof ApiError ? err.message : "Could not load users."
            )
          }
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

  function flash(message: string) {
    setSuccess(message)
    setError(null)
    window.setTimeout(() => setSuccess(null), 4000)
  }

  async function inviteUser(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await usersApi.create({
        email,
        password,
        full_name: fullName,
        role: inviteRole,
        company_name:
          inviteRole === "recruiter" ? inviteCompany.trim() || undefined : undefined,
      })
      setInviteOpen(false)
      setFullName("")
      setEmail("")
      setPassword("")
      setInviteCompany("")
      flash("User created successfully.")
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user.")
    }
  }

  function openEdit(user: AdminUser) {
    setEditUser(user)
    setEditName(user.full_name)
    setEditEmail(user.email)
    setEditRole(user.role)
    setEditCompany(user.company_name || "")
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editUser) return
    setBusyId(editUser.id)
    setError(null)
    try {
      const payload: {
        full_name: string
        email?: string
        role?: UserRole
        company_name?: string | null
      } = {
        full_name: editName.trim(),
      }
      if (!editUser.is_super_admin) {
        payload.email = editEmail.trim()
        payload.role = editRole
        payload.company_name =
          editRole === "recruiter" ? editCompany.trim() || null : null
      }
      await usersApi.update(editUser.id, payload)
      setEditUser(null)
      flash("User updated.")
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed.")
    } finally {
      setBusyId(null)
    }
  }

  async function suspendUser(user: AdminUser) {
    if (user.is_super_admin) {
      setError("The Super Admin account cannot be suspended.")
      return
    }
    if (currentUser?.id === user.id) {
      setError("You cannot suspend your own account.")
      return
    }
    setBusyId(user.id)
    try {
      await usersApi.suspend(user.id)
      flash(`${user.full_name} suspended.`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Suspend failed.")
    } finally {
      setBusyId(null)
    }
  }

  async function activateUser(user: AdminUser) {
    setBusyId(user.id)
    try {
      await usersApi.activate(user.id)
      flash(`${user.full_name} activated.`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Activate failed.")
    } finally {
      setBusyId(null)
    }
  }

  async function deleteUser(user: AdminUser) {
    if (user.is_super_admin) {
      setError("The Super Admin account cannot be deleted.")
      return
    }
    if (currentUser?.id === user.id) {
      setError("You cannot delete your own account.")
      return
    }
    const ok = window.confirm(
      `Delete ${user.full_name} (${user.email})? This cannot be undone.`
    )
    if (!ok) return
    setBusyId(user.id)
    try {
      await usersApi.remove(user.id)
      flash("User deleted.")
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.")
    } finally {
      setBusyId(null)
    }
  }

  async function submitResetPassword(event: React.FormEvent) {
    event.preventDefault()
    if (!resetUser) return
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setBusyId(resetUser.id)
    try {
      await usersApi.resetPassword(resetUser.id, newPassword)
      setResetUser(null)
      setNewPassword("")
      setConfirmPassword("")
      flash(`Password reset for ${resetUser.full_name}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Password reset failed.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="User Management"
          description="View and manage every registered account. Admin access only."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw data-icon="inline-start" />
                Refresh
              </Button>
              <Button onClick={() => setInviteOpen((v) => !v)}>
                {inviteOpen ? "Close invite" : "Invite user"}
              </Button>
            </div>
          }
        />
      </FadeIn>

      {inviteOpen ? (
        <FadeIn>
          <form
            onSubmit={(e) => void inviteUser(e)}
            className="mb-4 grid gap-3 rounded-xl border border-border/70 bg-card/80 p-4 sm:grid-cols-2 lg:grid-cols-3"
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
              <Select
                value={inviteRole}
                onValueChange={(value) => {
                  if (value) setInviteRole(value as UserRole)
                }}
              >
                <SelectTrigger id="user_role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteRole === "recruiter" ? (
              <div className="space-y-1">
                <Label htmlFor="user_company">Company</Label>
                <Input
                  id="user_company"
                  value={inviteCompany}
                  onChange={(e) => setInviteCompany(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
            ) : null}
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Create user
              </Button>
            </div>
          </form>
        </FadeIn>
      ) : null}

      <FadeIn>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            placeholder="Search name, email, or company"
            className="max-w-sm"
          />
          <Select
            value={role || "all"}
            onValueChange={(value) => {
              setPage(1)
              setRole(!value || value === "all" ? "" : (value as UserRole))
            }}
          >
            <SelectTrigger className="w-full sm:w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleFilters.map((item) => (
                <SelectItem key={item.label} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1)
              setStatus((value as typeof status) || "all")
            }}
          >
            <SelectTrigger className="w-full sm:w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{total} users</p>
        </div>
      </FadeIn>

      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      ) : null}

      <FadeIn>
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Registration
                </TableHead>
                <TableHead className="hidden xl:table-cell">Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : null}
              {items.map((user) => {
                const isSelf = currentUser?.id === user.id
                const isProtected = Boolean(user.is_super_admin)
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {user.full_name}
                        {isProtected ? (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                            Super Admin
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.company_name || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={user.is_active ? "Active" : "Suspended"}
                      />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                      {formatDate(user.last_login)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Edit"
                          disabled={busyId === user.id}
                          onClick={() => openEdit(user)}
                        >
                          <Pencil />
                        </Button>
                        {user.is_active ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Suspend"
                            disabled={
                              busyId === user.id || isSelf || isProtected
                            }
                            title={
                              isProtected
                                ? "Super Admin cannot be suspended"
                                : undefined
                            }
                            onClick={() => void suspendUser(user)}
                          >
                            <UserX />
                          </Button>
                        ) : (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Activate"
                            disabled={busyId === user.id}
                            onClick={() => void activateUser(user)}
                          >
                            <UserCheck />
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Reset password"
                          disabled={
                            busyId === user.id ||
                            (isProtected && currentUser?.id !== user.id)
                          }
                          title={
                            isProtected && currentUser?.id !== user.id
                              ? "Only Super Admin can reset this password"
                              : undefined
                          }
                          onClick={() => {
                            setResetUser(user)
                            setNewPassword("")
                            setConfirmPassword("")
                          }}
                        >
                          <KeyRound />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete"
                          disabled={busyId === user.id || isSelf || isProtected}
                          title={
                            isProtected
                              ? "Super Admin cannot be deleted"
                              : undefined
                          }
                          onClick={() => void deleteUser(user)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </FadeIn>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Page {pages ? page : 0} of {pages}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pages || loading || pages === 0}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(editUser)}
        onOpenChange={(open) => {
          if (!open) setEditUser(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              {editUser?.is_super_admin
                ? "Super Admin email and role are locked. Name can still be updated."
                : "Update account details. Role changes take effect on next request."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void saveEdit(e)}>
            <div className="space-y-1">
              <Label htmlFor="edit_name">Name</Label>
              <Input
                id="edit_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                disabled={Boolean(editUser?.is_super_admin)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_role">Role</Label>
              <Select
                value={editRole}
                onValueChange={(value) => {
                  if (value) setEditRole(value as UserRole)
                }}
              >
                <SelectTrigger
                  id="edit_role"
                  className="w-full"
                  disabled={Boolean(editUser?.is_super_admin)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  {editRole === "candidate" ? (
                    <SelectItem value="candidate">Candidate</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admins may assign Recruiter or Admin. Existing Candidates can keep their role.
              </p>
            </div>
            {editRole === "recruiter" ? (
              <div className="space-y-1">
                <Label htmlFor="edit_company">Company</Label>
                <Input
                  id="edit_company"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                />
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busyId === editUser?.id}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetUser)}
        onOpenChange={(open) => {
          if (!open) setResetUser(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.full_name}. Existing sessions
              will be signed out.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void submitResetPassword(e)}>
            <div className="space-y-1">
              <Label htmlFor="reset_password">New password</Label>
              <Input
                id="reset_password"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reset_confirm">Confirm password</Label>
              <Input
                id="reset_confirm"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busyId === resetUser?.id}>
                Reset password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
