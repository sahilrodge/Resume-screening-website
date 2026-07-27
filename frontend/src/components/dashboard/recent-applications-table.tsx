import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const rows = [
  {
    candidate: "Ava Chen",
    role: "Senior Frontend Engineer",
    match: "92%",
    status: "Shortlisted",
    tone: "default" as const,
  },
  {
    candidate: "Marcus Lee",
    role: "Product Designer",
    match: "88%",
    status: "Interview",
    tone: "secondary" as const,
  },
  {
    candidate: "Priya Nair",
    role: "Backend Engineer",
    match: "81%",
    status: "Screening",
    tone: "outline" as const,
  },
  {
    candidate: "Jonah Brooks",
    role: "Recruiter Ops",
    match: "76%",
    status: "Applied",
    tone: "outline" as const,
  },
  {
    candidate: "Sofia Alvarez",
    role: "Data Analyst",
    match: "94%",
    status: "Offer",
    tone: "default" as const,
  },
]

export function RecentApplicationsTable() {
  return (
    <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
      <CardHeader>
        <CardTitle className="font-heading">Recent applications</CardTitle>
        <CardDescription>Latest candidates moving through the pipeline</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead className="hidden sm:table-cell">Role</TableHead>
              <TableHead>Match</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.candidate}>
                <TableCell className="font-medium">{row.candidate}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {row.role}
                </TableCell>
                <TableCell>{row.match}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={row.tone}>{row.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
