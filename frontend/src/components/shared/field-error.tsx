import { cn } from "@/lib/utils"

type FieldErrorProps = {
  id?: string
  children?: string | null
  className?: string
}

/** Accessible field-level validation message. */
export function FieldError({ id, children, className }: FieldErrorProps) {
  if (!children) return null
  return (
    <p
      id={id}
      role="alert"
      className={cn("text-xs text-destructive", className)}
    >
      {children}
    </p>
  )
}
