"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { CompanyProfileView } from "@/features/companies/company-profile-view"
import { companiesApi } from "@/services/companies"
import { ApiError } from "@/types/api"
import type { CompanyProfile } from "@/types/company"

const fieldClassName =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export default function DashboardCompanyProfilePage() {
  const params = useParams<{ id: string }>()
  const companyId = params.id

  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [industry, setIndustry] = useState("")
  const [location, setLocation] = useState("")
  const [website, setWebsite] = useState("")
  const [employeeCount, setEmployeeCount] = useState("")
  const [description, setDescription] = useState("")
  const [culture, setCulture] = useState("")
  const [benefitsText, setBenefitsText] = useState("")
  const [linkedin, setLinkedin] = useState("")

  function hydrateForm(data: CompanyProfile) {
    setName(data.name || "")
    setIndustry(data.industry || "")
    setLocation(data.location || "")
    setWebsite(data.website || "")
    setEmployeeCount(data.employee_count || "")
    setDescription(data.description || "")
    setCulture(data.culture || "")
    setBenefitsText((data.benefits || []).join("\n"))
    setLinkedin(data.social_links?.linkedin || "")
  }

  async function load() {
    const data = await companiesApi.get(companyId)
    setCompany(data)
    hydrateForm(data)
    return data
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
          setCompany(null)
          setError(
            err instanceof ApiError ? err.message : "Failed to load company."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  async function saveCompany(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError("Company name is required.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const benefits = benefitsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
      await companiesApi.update(companyId, {
        name: name.trim(),
        industry: industry.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
        employee_count: employeeCount.trim() || undefined,
        description: description.trim() || undefined,
        culture: culture.trim() || undefined,
        benefits,
        social_links: {
          linkedin: linkedin.trim() || null,
        },
      })
      await load()
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save company")
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {!loading && company ? (
          <FadeIn>
            <div className="mb-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing((prev) => !prev)
                  setError(null)
                  if (company) hydrateForm(company)
                }}
              >
                {editing ? "Cancel edit" : "Edit company"}
              </Button>
            </div>

            {editing ? (
              <form
                onSubmit={(e) => void saveCompany(e)}
                className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-5"
              >
                <h2 className="font-heading text-base font-semibold">
                  Edit company profile
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Company name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Headquarters</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employees">Employees</Label>
                    <Input
                      id="employees"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      placeholder="e.g. 1001-5000"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="description">About company</Label>
                    <textarea
                      id="description"
                      className={fieldClassName}
                      value={description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setDescription(e.target.value)
                      }
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="culture">Company culture</Label>
                    <textarea
                      id="culture"
                      className={fieldClassName}
                      value={culture}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setCulture(e.target.value)
                      }
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="benefits">Benefits (one per line)</Label>
                    <textarea
                      id="benefits"
                      className={fieldClassName}
                      value={benefitsText}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setBenefitsText(e.target.value)
                      }
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/company/..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            ) : (
              <CompanyProfileView
                company={company}
                backHref="/companies"
                backLabel="← Back to companies"
                jobHref={(jobId) => `/jobs/${jobId}`}
              />
            )}
          </FadeIn>
        ) : null}
      </div>
    </PageTransition>
  )
}
