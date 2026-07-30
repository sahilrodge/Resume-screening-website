"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: "default" | "destructive"
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Portal-based confirm modal — avoids transform/z-index issues from page motion. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, busy, onCancel])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Dismiss dialog"
        className="absolute inset-0 bg-black/45 supports-backdrop-filter:backdrop-blur-sm"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel()
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className={cn(
          "relative z-[101] w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl ring-1 ring-foreground/10"
        )}
      >
        <h2
          id="confirm-dialog-title"
          className="font-heading text-base font-semibold tracking-tight"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-2 text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
