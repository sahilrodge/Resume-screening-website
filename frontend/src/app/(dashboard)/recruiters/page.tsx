"use client"

import { useMemo, useState } from "react"
import { Plus, UserRoundPlus } from "lucide-react"

import { AdminTableShell } from "@/components/admin/admin-table-shell"
import { DataToolbar } from "@/components/admin/data-toolbar"
import { StatusBadge } from "@/components/admin/status-badge"
import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { recruiters } from "@/data/admin-mock"

export default function RecruitersPage() {
  const [query, setQuery] = useState("")

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recruiters
    return recruiters.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <PageTransition>
      <FadeIn>
        <PageHeader
          title="Recruiters"
          description="Track recruiter capacity, hires, and account status."
          actions={
            <Button>
              <UserRoundPlus data-icon="inline-start" />
              Invite recruiter
            </Button>
          }
        />
      </FadeIn>

      <FadeIn>
        <AdminTableShell
          title={`${rows.length} recruiters`}
          description="Performance snapshot with fake seed data."
          toolbar={
            <DataToolbar
              placeholder="Search recruiter or company..."
              value={query}
              onChange={setQuery}
              actions={
                <Button variant="outline" size="sm">
                  <Plus data-icon="inline-start" />
                  Bulk import
                </Button>
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recruiter</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead>Open jobs</TableHead>
                <TableHead className="hidden sm:table-cell">Hires</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{row.company}</TableCell>
                  <TableCell>{row.openJobs}</TableCell>
                  <TableCell className="hidden sm:table-cell">{row.hires}</TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableShell>
      </FadeIn>
    </PageTransition>
  )
}
