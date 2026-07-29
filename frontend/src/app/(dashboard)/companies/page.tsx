"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Building2, Plus } from "lucide-react"
import { motion } from "framer-motion"

import { DataToolbar } from "@/components/admin/data-toolbar"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { companiesApi } from "@/services/companies"
import { ApiError } from "@/types/api"
import type { Company } from "@/types/company"
import { cn } from "@/lib/utils"

export default function CompaniesPage() {
  const [query, setQuery] = useState("")
  const [companies, setCompanies] = useState<Company[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState("")
  const [industry, setIndustry] = useState("")
  const [location, setLocation] = useState("")
  const [website, setWebsite] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await companiesApi.list()
    setCompanies(res.items ?? [])
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void load()
      .then(() => {
        if (!cancelled) setError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setCompanies([])
          setError(err instanceof ApiError ? err.message : "Could not load companies")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q)
    )
  }, [query, companies])

  async function createCompany(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await companiesApi.create({
        name,
        industry: industry || undefined,
        location: location || undefined,
        website: website || undefined,
        description: description || undefined,
      })
      setFormOpen(false)
      setName("")
      setIndustry("")
      setLocation("")
      setWebsite("")
      setDescription("")
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create company")
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Companies"
          description="Manage employer accounts, industries, and open demand."
          actions={
            <Button onClick={() => setFormOpen((v) => !v)}>
              <Plus data-icon="inline-start" />
              Add company
            </Button>
          }
        />
      </FadeIn>

      {formOpen ? (
        <FadeIn>
          <form
            onSubmit={createCompany}
            className="mb-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <Label htmlFor="company_name">Name</Label>
              <Input
                id="company_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="company_industry">Industry</Label>
              <Input
                id="company_industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="company_location">Location</Label>
              <Input
                id="company_location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="company_website">Website</Label>
              <Input
                id="company_website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="company_description">Description</Label>
              <Input
                id="company_description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create company"}
              </Button>
            </div>
          </form>
        </FadeIn>
      ) : null}

      <FadeIn>
        <DataToolbar
          placeholder="Search companies..."
          value={query}
          onChange={setQuery}
        />
      </FadeIn>

      {error ? (
        <FadeIn>
          <Card className="border-destructive/40 bg-destructive/5 shadow-none">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        </FadeIn>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <FadeIn>
          <Card className="border-border/70 bg-card/80 shadow-none">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No companies yet. Add one to attach jobs.
            </CardContent>
          </Card>
        </FadeIn>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((company, index) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
          >
            <Link href={`/companies/${company.id}`} className="block h-full">
              <Card className="h-full border-border/70 bg-card/80 shadow-none backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/30">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {company.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={company.logo_url}
                        alt=""
                        className="size-10 rounded-md border border-border bg-background object-contain p-1"
                      />
                    ) : (
                      <span className="rounded-xl bg-primary/10 p-2 text-primary">
                        <Building2 className="size-4" />
                      </span>
                    )}
                    <div className="space-y-1">
                      <CardTitle className="font-heading text-lg">
                        {company.name}
                      </CardTitle>
                      <CardDescription>
                        {company.industry || "Industry not set"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Headquarters</span>
                    <span className="truncate text-right">
                      {company.location || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Employees</span>
                    <span className="truncate text-right">
                      {company.employee_count || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Open jobs</span>
                    <span className="truncate text-right">
                      {company.open_jobs_count ?? 0}
                    </span>
                  </div>
                  {company.description ? (
                    <p className="line-clamp-3 text-muted-foreground">
                      {company.description}
                    </p>
                  ) : null}
                  <span
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "pointer-events-none"
                    )}
                  >
                    View profile
                  </span>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </PageTransition>
  )
}
