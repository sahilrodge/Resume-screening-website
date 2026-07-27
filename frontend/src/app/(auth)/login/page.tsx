import { Suspense } from "react"

import { LoginForm } from "@/features/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <Card className="border-border/70 bg-card/90 shadow-none backdrop-blur">
      <CardHeader>
        <CardTitle className="font-heading">Welcome back</CardTitle>
        <CardDescription>Sign in to your HirePulse workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
