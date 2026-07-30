"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, X } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastTone = "success" | "error" | "info"

type ToastItem = {
  id: string
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setItems((current) => [...current, { id, message, tone }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed right-4 bottom-4 z-[120] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
              aria-live="polite"
              aria-relevant="additions"
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-lg",
                    item.tone === "success" &&
                      "border-emerald-500/30 bg-card text-foreground",
                    item.tone === "error" &&
                      "border-destructive/30 bg-card text-foreground",
                    item.tone === "info" &&
                      "border-sky-500/30 bg-card text-foreground"
                  )}
                  role="status"
                >
                  {item.tone === "success" ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : null}
                  <p className="min-w-0 flex-1 leading-relaxed">{item.message}</p>
                  <button
                    type="button"
                    className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(item.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      toast: (message: string) => {
        if (typeof window !== "undefined") window.alert(message)
      },
    }
  }
  return ctx
}
