export function normalizeApiUrl(raw?: string | null): string {
  const fallback = "http://127.0.0.1:8000/api/v1"
  if (!raw?.trim()) return fallback
  const trimmed = raw.trim().replace(/\/$/, "")
  if (trimmed.endsWith("/api/v1")) return trimmed
  return `${trimmed}/api/v1`
}

export const env = {
  apiUrl: normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "HirePulse",
  isProduction: process.env.NODE_ENV === "production",
} as const

if (
  env.isProduction &&
  (env.apiUrl.includes("127.0.0.1") || env.apiUrl.includes("localhost"))
) {
  console.warn(
    "[env] NEXT_PUBLIC_API_URL looks like a local URL in production. Set your Railway API URL."
  )
}
