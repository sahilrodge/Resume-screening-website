import { Sparkles } from "lucide-react"

import { appName, appTagline } from "@/config/navigation"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.72_0.1_195_/_0.18),_transparent_55%)]" />
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{appName}</h1>
            <p className="text-sm text-muted-foreground">{appTagline}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
