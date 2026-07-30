import { LoaderCircle } from "lucide-react"

export function AuthLoading() {
  return (
    <div
      className="flex min-h-svh items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Connecting to workspace…
      </div>
    </div>
  )
}
