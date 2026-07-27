import { BriefcaseBusiness, CalendarCheck2, FileSearch, Users } from "lucide-react"

import { StatCard } from "@/components/shared/stat-card"

const stats = [
  {
    title: "Open jobs",
    value: "24",
    delta: "+3 this week",
    trend: "up" as const,
    icon: BriefcaseBusiness,
  },
  {
    title: "Active candidates",
    value: "1,284",
    delta: "+12% vs last month",
    trend: "up" as const,
    icon: Users,
  },
  {
    title: "Resumes screened",
    value: "486",
    delta: "AI match avg 78%",
    trend: "neutral" as const,
    icon: FileSearch,
  },
  {
    title: "Interviews booked",
    value: "39",
    delta: "8 pending today",
    trend: "down" as const,
    icon: CalendarCheck2,
  },
]

export function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  )
}
