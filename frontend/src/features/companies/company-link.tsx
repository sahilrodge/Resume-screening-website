"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type CompanyLinkProps = {
  companyId?: string | null
  name?: string | null
  hrefBase?: "/portal/companies" | "/companies"
  className?: string
  children?: ReactNode
}

/** Clickable company name/logo target that opens the company profile. */
export function CompanyLink({
  companyId,
  name,
  hrefBase = "/portal/companies",
  className,
  children,
}: CompanyLinkProps) {
  const label = children ?? name ?? "Company"
  if (!companyId) {
    return <span className={className}>{label}</span>
  }
  return (
    <Link
      href={`${hrefBase}/${companyId}`}
      className={cn(
        "underline-offset-4 hover:underline focus-visible:outline-none",
        className
      )}
    >
      {label}
    </Link>
  )
}
