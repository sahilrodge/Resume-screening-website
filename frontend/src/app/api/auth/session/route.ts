import { NextResponse, type NextRequest } from "next/server"

import {
  SESSION_COOKIE,
  SESSION_REMEMBER_MAX_AGE_SECONDS,
  buildSessionPayload,
  signSessionCookie,
} from "@/lib/auth-roles"
import type { UserRole } from "@/types/auth"

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000/api/v1"
  )
}

function isSecureRequest(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return true
  const proto = request.headers.get("x-forwarded-proto")
  if (proto) return proto.split(",")[0]?.trim() === "https"
  return request.nextUrl.protocol === "https:"
}

function sessionCookieOptions(
  secure: boolean,
  maxAge?: number
): {
  httpOnly: boolean
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge?: number
} {
  const options: {
    httpOnly: boolean
    secure: boolean
    sameSite: "lax"
    path: string
    maxAge?: number
  } = {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  }
  // Omit maxAge for browser-session cookies (cleared when the browser closes).
  if (typeof maxAge === "number") {
    options.maxAge = maxAge
  }
  return options
}

type SessionBody = {
  remember_me?: boolean
  max_age_seconds?: number | null
}

/**
 * Establish a signed HttpOnly session cookie for middleware RBAC.
 * Requires Authorization: Bearer <access_token> and AUTH_SECRET.
 * Stores role + profile identifiers for route protection across refreshes.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { detail: "AUTH_SECRET is not configured" },
      { status: 500 }
    )
  }

  const auth = request.headers.get("authorization")
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ detail: "Missing bearer token" }, { status: 401 })
  }
  const accessToken = auth.slice(7).trim()
  if (!accessToken) {
    return NextResponse.json({ detail: "Missing bearer token" }, { status: 401 })
  }

  let body: SessionBody = {}
  try {
    body = (await request.json()) as SessionBody
  } catch {
    body = {}
  }

  const meRes = await fetch(`${getApiBase()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!meRes.ok) {
    return NextResponse.json({ detail: "Invalid session" }, { status: 401 })
  }

  const user = (await meRes.json()) as {
    id: string
    role: UserRole
    email?: string
    full_name?: string
  }
  if (!user?.id || !user?.role) {
    return NextResponse.json({ detail: "Invalid user payload" }, { status: 401 })
  }

  const rememberMe = Boolean(body.remember_me)
  const maxAge = rememberMe
    ? typeof body.max_age_seconds === "number" && body.max_age_seconds > 0
      ? body.max_age_seconds
      : SESSION_REMEMBER_MAX_AGE_SECONDS
    : undefined

  const value = await signSessionCookie(
    buildSessionPayload(user.role, user.id, {
      // Cookie payload expiry: remember uses long TTL; session uses 1 day absolute max.
      maxAgeSeconds: maxAge ?? 60 * 60 * 24,
      email: user.email,
      full_name: user.full_name,
      remember_me: rememberMe,
    }),
    secret
  )
  const response = NextResponse.json({
    ok: true,
    role: user.role,
    remember_me: rememberMe,
  })
  response.cookies.set(
    SESSION_COOKIE,
    value,
    sessionCookieOptions(isSecureRequest(request), maxAge)
  )
  return response
}

/** Destroy the middleware session cookie (logout). */
export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(isSecureRequest(request), 0),
    maxAge: 0,
  })
  return response
}
