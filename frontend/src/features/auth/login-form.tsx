"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/features/auth/auth-provider"
import { canAccessPath, homeForRole } from "@/lib/auth-roles"
import { ApiError } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function safeNextPath(raw: string | null, role: string): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null
  if (raw.startsWith("/login") || raw.startsWith("/register")) return null
  if (!canAccessPath(role as "admin" | "recruiter" | "candidate", raw)) {
    return null
  }
  return raw
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const data = await login({
        email,
        password,
        remember_me: rememberMe,
      })
      const next = safeNextPath(searchParams.get("next"), data.user.role)
      router.replace(next ?? homeForRole(data.user.role))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={rememberMe}
          onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
        />
        Remember me for 30 days
      </label>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </form>
  )
}
