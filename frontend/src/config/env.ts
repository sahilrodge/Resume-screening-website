const LOCAL_API = "http://127.0.0.1:8000/api/v1"

/**
 * Browser API base URL.
 * On Vercel we always use same-origin `/api/v1` (rewritten to Railway in next.config).
 * Locally we talk to FastAPI on port 8000 unless NEXT_PUBLIC_API_URL overrides.
 */
export function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim()

  // Explicit relative proxy
  if (raw === "/api/v1" || raw?.replace(/\/$/, "") === "/api/v1") {
    return "/api/v1"
  }

  // Production / Vercel builds must never call localhost from the browser
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    if (
      !raw ||
      raw.includes("127.0.0.1") ||
      raw.includes("localhost") ||
      raw.includes("up.railway.app")
    ) {
      // Prefer same-origin proxy (see next.config.ts rewrites)
      return "/api/v1"
    }
  }

  if (!raw) return LOCAL_API
  const trimmed = raw.replace(/\/$/, "")
  if (trimmed.endsWith("/api/v1")) return trimmed
  return `${trimmed}/api/v1`
}

export const env = {
  apiUrl: resolveApiUrl(),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "HirePulse",
  isProduction: process.env.NODE_ENV === "production",
} as const
