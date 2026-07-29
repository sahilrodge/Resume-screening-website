import type { UserRole } from "@/types/auth"

/** HttpOnly cookie set by /api/auth/session for middleware RBAC. */
export const SESSION_COOKIE = "hirepulse_session"

/** Session lifetimes (seconds) — aligned with backend refresh TTLs. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
export const SESSION_REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
/** Idle timeout for authenticated browser sessions (ms). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

export const PUBLIC_PATHS = ["/login", "/register"] as const

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/dashboard",
  recruiter: "/dashboard",
  candidate: "/portal",
}

/**
 * Exact sidebar destinations + nested routes allowed per role.
 * Keep in sync with `navForRole` in `@/config/navigation`.
 */
export const ROLE_ALLOWED_PREFIXES: Record<UserRole, readonly string[]> = {
  admin: [
    "/dashboard",
    "/users",
    "/recruiters",
    "/candidates",
    "/jobs",
    "/companies",
    "/screening",
    "/interviews",
    "/resumes",
    "/assistant",
    "/analytics",
    "/reports",
    "/notifications",
    "/profile",
    "/settings",
  ],
  recruiter: [
    "/dashboard",
    "/jobs",
    "/companies",
    "/candidates",
    "/screening",
    "/interviews",
    "/resumes",
    "/assistant",
    "/analytics",
    "/notifications",
    "/profile",
    "/settings",
  ],
  candidate: [
    "/portal",
    "/portal/screening",
    "/portal/assistant",
    "/portal/jobs",
    "/portal/saved-jobs",
    "/portal/companies",
    "/portal/notifications",
    "/portal/profile",
    "/portal/settings",
    // Legacy redirects
    "/portal/applications",
  ],
}

export function homeForRole(role: UserRole): string {
  return ROLE_HOME[role] ?? "/login"
}

export function isStaffRole(role: UserRole | undefined | null): boolean {
  return role === "admin" || role === "recruiter"
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

/** Paths that are dashboards only — nested URLs must be listed separately. */
const EXACT_MATCH_ONLY = new Set(["/portal", "/dashboard"])

export function pathAllowedForRole(role: UserRole, pathname: string): boolean {
  return ROLE_ALLOWED_PREFIXES[role].some((prefix) => {
    if (pathname === prefix) return true
    if (EXACT_MATCH_ONLY.has(prefix)) return false
    return pathname.startsWith(`${prefix}/`)
  })
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (isPublicPath(pathname) || pathname === "/") return true
  if (pathname.startsWith("/api/")) return true
  return pathAllowedForRole(role, pathname)
}

export type SessionCookiePayload = {
  role: UserRole
  uid: string
  exp: number
  email?: string
  full_name?: string
  remember_me?: boolean
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ""
  view.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function encodePayload(payload: SessionCookiePayload): string {
  const json = JSON.stringify(payload)
  if (typeof btoa === "function") {
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
  }
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodePayload(encoded: string): SessionCookiePayload | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/")
    const pad =
      padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
    const json =
      typeof atob === "function"
        ? atob(padded + pad)
        : Buffer.from(padded + pad, "base64").toString("utf8")
    const data = JSON.parse(json) as SessionCookiePayload
    if (!data?.role || !data?.uid || !data?.exp) return null
    if (data.exp * 1000 < Date.now()) return null
    if (!["admin", "recruiter", "candidate"].includes(data.role)) return null
    return data
  } catch {
    return null
  }
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  )
  return toBase64Url(sig)
}

async function hmacVerify(
  message: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await hmacSign(message, secret)
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

export function buildSessionPayload(
  role: UserRole,
  uid: string,
  options?: {
    maxAgeSeconds?: number
    email?: string
    full_name?: string
    remember_me?: boolean
  }
): SessionCookiePayload {
  const maxAge =
    options?.maxAgeSeconds ??
    (options?.remember_me
      ? SESSION_REMEMBER_MAX_AGE_SECONDS
      : 60 * 60 * 24)
  return {
    role,
    uid,
    email: options?.email,
    full_name: options?.full_name,
    remember_me: options?.remember_me ?? false,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  }
}

/** Sign session cookie value (payload.signature). Requires server secret. */
export async function signSessionCookie(
  payload: SessionCookiePayload,
  secret: string
): Promise<string> {
  const body = encodePayload(payload)
  const sig = await hmacSign(body, secret)
  return `${body}.${sig}`
}

export async function verifySessionCookie(
  value: string | undefined | null,
  secret: string | undefined | null
): Promise<SessionCookiePayload | null> {
  if (!value || !secret) return null
  const [body, sig] = value.split(".")
  if (!body || !sig) return null
  const ok = await hmacVerify(body, sig, secret)
  if (!ok) return null
  return decodePayload(body)
}
