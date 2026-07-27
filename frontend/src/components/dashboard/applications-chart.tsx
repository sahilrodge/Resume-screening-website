"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { month: "Jan", applications: 186, screened: 120 },
  { month: "Feb", applications: 205, screened: 148 },
  { month: "Mar", applications: 237, screened: 190 },
  { month: "Apr", applications: 273, screened: 220 },
  { month: "May", applications: 309, screened: 260 },
  { month: "Jun", applications: 344, screened: 298 },
]

const chartConfig = {
  applications: {
    label: "Applications",
    color: "var(--chart-1)",
  },
  screened: {
    label: "AI screened",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ApplicationsChart() {
  return (
    <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
      <CardHeader>
        <CardTitle className="font-heading">Pipeline volume</CardTitle>
        <CardDescription>Applications vs AI-screened resumes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="screened"
              type="monotone"
              fill="var(--color-screened)"
              fillOpacity={0.25}
              stroke="var(--color-screened)"
              strokeWidth={2}
            />
            <Area
              dataKey="applications"
              type="monotone"
              fill="var(--color-applications)"
              fillOpacity={0.15}
              stroke="var(--color-applications)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
