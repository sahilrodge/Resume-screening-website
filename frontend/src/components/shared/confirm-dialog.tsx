"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

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

/**
 * Controlled confirm modal on the shared Dialog primitive.
 *
 * Important: do not set initialFocus={false}. With modal dialogs, leaving focus
 * on the outside trigger causes an immediate focus-out close — Select/Reject
 * then looks like a no-op (popup never appears).
 */
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
  return (
    <Dialog
      open={open}
      // Confirm actions use explicit Cancel / Confirm buttons. Disabling
      // pointer dismissal also avoids the opening click dismissing the modal.
      disablePointerDismissal
      onOpenChange={(next) => {
        if (!next && !busy) onCancel()
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!busy) onCancel()
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={busy}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onConfirm()
            }}
          >
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
