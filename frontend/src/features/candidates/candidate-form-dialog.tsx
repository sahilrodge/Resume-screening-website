"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  candidateCreateSchema,
  candidateUpdateSchema,
  type CandidateCreateValues,
  type CandidateUpdateValues,
} from "@/features/candidates/schemas"
import type { Candidate } from "@/types/candidate"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "create" | "edit"

type CandidateFormDialogProps = {
  open: boolean
  mode: Mode
  candidate?: Candidate | null
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (values: CandidateCreateValues) => Promise<void>
  onUpdate: (values: CandidateUpdateValues) => Promise<void>
}

export function CandidateFormDialog({
  open,
  mode,
  candidate,
  submitting,
  onOpenChange,
  onCreate,
  onUpdate,
}: CandidateFormDialogProps) {
  const createForm = useForm<CandidateCreateValues>({
    resolver: zodResolver(candidateCreateSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      phone: "",
      location: "",
      current_title: "",
      headline: "",
      years_experience: "",
      linkedin_url: "",
      portfolio_url: "",
      summary: "",
    },
  })

  const editForm = useForm<CandidateUpdateValues>({
    resolver: zodResolver(candidateUpdateSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      location: "",
      current_title: "",
      headline: "",
      years_experience: "",
      linkedin_url: "",
      portfolio_url: "",
      summary: "",
      is_active: true,
    },
  })

  useEffect(() => {
    if (!open) return
    if (mode === "create") {
      createForm.reset({
        full_name: "",
        email: "",
        password: "",
        phone: "",
        location: "",
        current_title: "",
        headline: "",
        years_experience: "",
        linkedin_url: "",
        portfolio_url: "",
        summary: "",
      })
    } else if (candidate) {
      editForm.reset({
        full_name: candidate.full_name,
        phone: candidate.phone ?? "",
        location: candidate.location ?? "",
        current_title: candidate.current_title ?? "",
        headline: candidate.headline ?? "",
        years_experience:
          candidate.years_experience != null
            ? String(candidate.years_experience)
            : "",
        linkedin_url: candidate.linkedin_url ?? "",
        portfolio_url: candidate.portfolio_url ?? "",
        summary: candidate.summary ?? "",
        is_active: candidate.is_active,
      })
    }
  }, [open, mode, candidate, createForm, editForm])

  async function submitCreate(values: CandidateCreateValues) {
    await onCreate(values)
  }

  async function submitUpdate(values: CandidateUpdateValues) {
    await onUpdate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {mode === "create" ? "Add candidate" : "Edit candidate"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Creates a candidate account and profile."
              : "Update profile details for this candidate."}
          </DialogDescription>
        </DialogHeader>

        {mode === "create" ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={createForm.handleSubmit(submitCreate)}
          >
            <Field
              label="Full name"
              error={createForm.formState.errors.full_name?.message}
              className="sm:col-span-2"
            >
              <Input {...createForm.register("full_name")} />
            </Field>
            <Field label="Email" error={createForm.formState.errors.email?.message}>
              <Input type="email" {...createForm.register("email")} />
            </Field>
            <Field
              label="Password"
              error={createForm.formState.errors.password?.message}
            >
              <Input type="password" {...createForm.register("password")} />
            </Field>
            <Field label="Phone" error={createForm.formState.errors.phone?.message}>
              <Input {...createForm.register("phone")} />
            </Field>
            <Field
              label="Location"
              error={createForm.formState.errors.location?.message}
            >
              <Input {...createForm.register("location")} />
            </Field>
            <Field
              label="Current title"
              error={createForm.formState.errors.current_title?.message}
            >
              <Input {...createForm.register("current_title")} />
            </Field>
            <Field
              label="Years experience"
              error={createForm.formState.errors.years_experience?.message}
            >
              <Input type="number" min={0} max={80} {...createForm.register("years_experience")} />
            </Field>
            <Field
              label="Headline"
              error={createForm.formState.errors.headline?.message}
              className="sm:col-span-2"
            >
              <Input {...createForm.register("headline")} />
            </Field>
            <Field
              label="LinkedIn URL"
              error={createForm.formState.errors.linkedin_url?.message}
            >
              <Input {...createForm.register("linkedin_url")} />
            </Field>
            <Field
              label="Portfolio URL"
              error={createForm.formState.errors.portfolio_url?.message}
            >
              <Input {...createForm.register("portfolio_url")} />
            </Field>
            <Field
              label="Summary"
              error={createForm.formState.errors.summary?.message}
              className="sm:col-span-2"
            >
              <Input {...createForm.register("summary")} />
            </Field>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={editForm.handleSubmit(submitUpdate)}
          >
            <Field
              label="Full name"
              error={editForm.formState.errors.full_name?.message}
              className="sm:col-span-2"
            >
              <Input {...editForm.register("full_name")} />
            </Field>
            <Field label="Phone" error={editForm.formState.errors.phone?.message}>
              <Input {...editForm.register("phone")} />
            </Field>
            <Field label="Location" error={editForm.formState.errors.location?.message}>
              <Input {...editForm.register("location")} />
            </Field>
            <Field
              label="Current title"
              error={editForm.formState.errors.current_title?.message}
            >
              <Input {...editForm.register("current_title")} />
            </Field>
            <Field
              label="Years experience"
              error={editForm.formState.errors.years_experience?.message}
            >
              <Input type="number" min={0} max={80} {...editForm.register("years_experience")} />
            </Field>
            <Field
              label="Headline"
              error={editForm.formState.errors.headline?.message}
              className="sm:col-span-2"
            >
              <Input {...editForm.register("headline")} />
            </Field>
            <Field
              label="LinkedIn URL"
              error={editForm.formState.errors.linkedin_url?.message}
            >
              <Input {...editForm.register("linkedin_url")} />
            </Field>
            <Field
              label="Portfolio URL"
              error={editForm.formState.errors.portfolio_url?.message}
            >
              <Input {...editForm.register("portfolio_url")} />
            </Field>
            <Field
              label="Summary"
              error={editForm.formState.errors.summary?.message}
              className="sm:col-span-2"
            >
              <Input {...editForm.register("summary")} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" {...editForm.register("is_active")} />
              Active account
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
