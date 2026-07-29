"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { Skeleton } from "@/components/ui/skeleton"
import { CompanyProfileView } from "@/features/companies/company-profile-view"
import { companiesApi } from "@/services/companies"
import { ApiError } from "@/types/api"
import type { CompanyProfile } from "@/types/company"

export default function PortalCompanyProfilePage() {
  const params = useParams<{ id: string }>()
  const companyId = params.id

  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    companiesApi
      .get(companyId)
      .then((data) => {
        if (cancelled) return
        setCompany(data)
        setError(null)
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
  }, [companyId])

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl">
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
            <CompanyProfileView
              company={company}
              backHref="/portal/jobs"
              backLabel="← Back to jobs"
              jobHref={(jobId) => `/portal/jobs/${jobId}`}
            />
          </FadeIn>
        ) : null}
      </div>
    </PageTransition>
  )
}
