"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  jobCreateSchema,
  jobUpdateSchema,
  type JobCreateValues,
  type JobUpdateValues,
} from "@/features/jobs/schemas"
import { companiesApi } from "@/services/companies"
import type { Company } from "@/types/company"
import type { Job } from "@/types/job"
import { ApiError } from "@/types/api"

type Mode = "create" | "edit"

type JobFormDialogProps = {
  open: boolean
  mode: Mode
  job?: Job | null
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (values: JobCreateValues) => Promise<void>
  onUpdate?: (values: JobUpdateValues) => Promise<void>
}

const defaultValues: JobCreateValues = {
  company_id: "",
  title: "",
  description: "",
  location: "",
  employment_type: "full_time",
  status: "draft",
  salary_min: "",
  salary_max: "",
  currency: "USD",
  experience_min_years: "",
  experience_max_years: "",
  openings: "1",
  closes_at: "",
  skills: "",
}

export function JobFormDialog({
  open,
  mode,
  job,
  submitting,
  onOpenChange,
  onCreate,
  onUpdate,
}: JobFormDialogProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [newCompanyName, setNewCompanyName] = useState("")
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [creatingCompany, setCreatingCompany] = useState(false)

  const createForm = useForm<JobCreateValues>({
    resolver: zodResolver(jobCreateSchema),
    defaultValues,
  })

  const editForm = useForm<JobUpdateValues>({
    resolver: zodResolver(jobUpdateSchema),
    defaultValues,
  })

  async function loadCompanies() {
    try {
      const data = await companiesApi.list()
      setCompanies(data.items)
      return data.items
    } catch {
      setCompanies([])
      return []
    }
  }

  useEffect(() => {
    if (!open) return
    void loadCompanies().then((items) => {
      if (mode === "create") {
        createForm.reset({
          ...defaultValues,
          company_id: items[0]?.id ?? "",
        })
        setNewCompanyName("")
        setCompanyError(null)
      } else if (job) {
        editForm.reset({
          company_id: job.company_id,
          title: job.title,
          description: job.description,
          location: job.location ?? "",
          employment_type: job.employment_type,
          status: job.status,
          salary_min: job.salary_min != null ? String(job.salary_min) : "",
          salary_max: job.salary_max != null ? String(job.salary_max) : "",
          currency: job.currency || "USD",
          experience_min_years:
            job.experience_min_years != null ? String(job.experience_min_years) : "",
          experience_max_years:
            job.experience_max_years != null ? String(job.experience_max_years) : "",
          openings: String(job.openings ?? 1),
          closes_at: job.closes_at
            ? new Date(job.closes_at).toISOString().slice(0, 10)
            : "",
          skills: (job.skills ?? []).join(", "),
        })
      }
    })
  }, [open, mode, job, createForm, editForm])

  async function handleCreateCompany() {
    const name = newCompanyName.trim()
    if (!name) {
      setCompanyError("Enter a company name")
      return
    }
    setCreatingCompany(true)
    setCompanyError(null)
    try {
      const created = await companiesApi.create({ name })
      const items = await loadCompanies()
      const form = mode === "create" ? createForm : editForm
      form.setValue("company_id", created.id || items.find((c) => c.name === name)?.id || "")
      setNewCompanyName("")
    } catch (err) {
      setCompanyError(err instanceof ApiError ? err.message : "Failed to create company")
    } finally {
      setCreatingCompany(false)
    }
  }

  async function submitCreate(values: JobCreateValues) {
    if (!onCreate) return
    await onCreate(values)
  }

  async function submitUpdate(values: JobUpdateValues) {
    if (!onUpdate) return
    await onUpdate(values)
  }

  const form = mode === "create" ? createForm : editForm
  const onSubmit = mode === "create" ? submitCreate : submitUpdate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create job" : "Update job"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Publish a new role for recruiters to screen against."
              : "Edit job details, status, and openings."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="grid gap-2">
            <Label htmlFor="company_id">Company</Label>
            <Controller
              control={form.control}
              name="company_id"
              render={({ field }) => {
                const companyItems = [
                  { value: "__none__", label: "Select company" },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]
                return (
                  <Select
                    value={field.value || "__none__"}
                    onValueChange={(value) =>
                      field.onChange(!value || value === "__none__" ? "" : value)
                    }
                    items={companyItems}
                  >
                    <SelectTrigger id="company_id" className="w-full">
                      <SelectValue placeholder="Select company">
                        {(value) => {
                          if (!value || value === "__none__") return null
                          return (
                            companies.find((c) => c.id === value)?.name || null
                          )
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" label="Select company">
                        Select company
                      </SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id} label={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              }}
            />
            {form.formState.errors.company_id ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.company_id.message}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Input
                placeholder="Or create company…"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={creatingCompany}
                onClick={() => void handleCreateCompany()}
              >
                Add
              </Button>
            </div>
            {companyError ? (
              <p className="text-xs text-destructive">{companyError}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={4}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...form.register("location")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="openings">Openings</Label>
              <Input id="openings" {...form.register("openings")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="employment_type">Employment type</Label>
              <Controller
                control={form.control}
                name="employment_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) field.onChange(value)
                    }}
                  >
                    <SelectTrigger id="employment_type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full-time</SelectItem>
                      <SelectItem value="part_time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) field.onChange(value)
                    }}
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="filled">Filled</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="salary_min">Salary min</Label>
              <Input id="salary_min" {...form.register("salary_min")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="salary_max">Salary max</Label>
              <Input id="salary_max" {...form.register("salary_max")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" {...form.register("currency")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="experience_min_years">Exp min (years)</Label>
              <Input id="experience_min_years" {...form.register("experience_min_years")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="experience_max_years">Exp max (years)</Label>
              <Input id="experience_max_years" {...form.register("experience_max_years")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="closes_at">Application deadline</Label>
              <Input id="closes_at" type="date" {...form.register("closes_at")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                placeholder="Python, React, SQL"
                {...form.register("skills")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : mode === "create" ? "Create job" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
