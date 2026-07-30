import { HirePulseMark } from "@/components/brand/hirepulse-mark"
import { appName, appTagline } from "@/config/navigation"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.72_0.1_195_/_0.18),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.45_0.08_195_/_0.28),_transparent_55%)]"
      />
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <HirePulseMark size="lg" />
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {appName}
            </h1>
            <p className="text-sm text-muted-foreground">{appTagline}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
