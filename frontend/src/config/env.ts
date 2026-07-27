export const env = {
  apiUrl:
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:8000/api/v1",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "HirePulse",
  isProduction: process.env.NODE_ENV === "production",
} as const

if (
  env.isProduction &&
  (!process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_URL.includes("127.0.0.1") ||
    process.env.NEXT_PUBLIC_API_URL.includes("localhost"))
) {
  // Surfaced in server logs during `next build` / runtime — helps catch misconfig.
  console.warn(
    "[env] NEXT_PUBLIC_API_URL looks like a local URL in production. Set your Railway API URL."
  )
}
