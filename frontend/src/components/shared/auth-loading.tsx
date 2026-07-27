import { LoaderCircle } from "lucide-react"

export function AuthLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Connecting to workspace...
      </div>
    </div>
  )
}
