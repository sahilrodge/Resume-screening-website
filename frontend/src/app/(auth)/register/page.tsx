import { RegisterForm } from "@/features/auth/register-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RegisterPage() {
  return (
    <Card className="border-border/70 bg-card/90 shadow-none backdrop-blur">
      <CardHeader>
        <CardTitle className="font-heading">Create account</CardTitle>
        <CardDescription>Connect to the recruitment API and get started</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  )
}
