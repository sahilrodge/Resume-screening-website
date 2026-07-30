"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { InlineAlert } from "@/components/shared/inline-alert"
import { useAuth } from "@/features/auth/auth-provider"
import { homeForRole } from "@/lib/auth-roles"
import { ApiError } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PASSWORD_HINT = "Letters + number, min. 8 characters"

export function RegisterForm() {
  const router = useRouter()
  const { register } = useAuth()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setSubmitting(true)
    try {
      const data = await register({
        email,
        password,
        full_name: fullName,
        confirm_password: confirmPassword,
      })
      router.replace(homeForRole(data.user.role))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed")
    } finally {
      setSubmitting(false)
    }
  }

  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <InlineAlert variant="info">
        Public signup creates a <span className="font-medium">Candidate</span>{" "}
        account. Recruiter and Admin accounts are invited by an administrator.
      </InlineAlert>

      <div className="space-y-2">
        <Label htmlFor="full_name">Name</Label>
        <Input
          id="full_name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
          aria-invalid={error && !fullName.trim() ? true : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          pattern="^(?=.*[A-Za-z])(?=.*\d).+$"
          title={PASSWORD_HINT}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={PASSWORD_HINT}
          aria-describedby="password-hint"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter password"
          aria-invalid={passwordsMismatch || undefined}
        />
      </div>

      <p id="password-hint" className="text-xs text-muted-foreground">
        {PASSWORD_HINT}
      </p>

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating account…" : "Create candidate account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
