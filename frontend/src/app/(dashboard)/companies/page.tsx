"use client"

import { useMemo, useState } from "react"
import { Building2, Plus } from "lucide-react"
import { motion } from "framer-motion"

import { DataToolbar } from "@/components/admin/data-toolbar"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { companies } from "@/data/admin-mock"

export default function CompaniesPage() {
  const [query, setQuery] = useState("")

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Companies"
          description="Manage employer accounts, industries, and open demand."
          actions={
            <Button>
              <Plus data-icon="inline-start" />
              Add company
            </Button>
          }
        />
      </FadeIn>

      <FadeIn>
        <DataToolbar
          placeholder="Search companies..."
          value={query}
          onChange={setQuery}
        />
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((company, index) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
          >
            <Card className="h-full border-border/70 bg-card/80 shadow-none backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/30">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="font-heading text-lg">{company.name}</CardTitle>
                  <CardDescription>{company.industry}</CardDescription>
                </div>
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Building2 className="size-4" />
                </span>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span>{company.location}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Employees</span>
                  <span>{company.employees}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open roles</span>
                  <span className="font-medium text-primary">{company.openRoles}</span>
                </div>
                <div className="pt-1">
                  <StatusBadge status={company.status} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </PageTransition>
  )
}
