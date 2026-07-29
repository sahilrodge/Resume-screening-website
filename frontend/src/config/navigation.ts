import {
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FileBarChart,
  FileText,
  LayoutDashboard,
  ScanSearch,
  Settings,
  UserRound,
  UserRoundSearch,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { UserRole } from "@/types/auth"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description: string
}

/** Candidate portal navigation */
export const candidateNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/portal",
    icon: LayoutDashboard,
    description: "Your candidate overview",
  },
  {
    title: "Resume AI Screening",
    href: "/portal/screening",
    icon: ScanSearch,
    description: "AI match scores for your applications",
  },
  {
    title: "AI Assistant",
    href: "/portal/assistant",
    icon: Bot,
    description: "Resume tips, interview prep, and career advice",
  },
  {
    title: "Jobs",
    href: "/portal/jobs",
    icon: BriefcaseBusiness,
    description: "Browse open roles and your applications",
  },
  {
    title: "Notifications",
    href: "/portal/notifications",
    icon: Bell,
    description: "Updates about your applications",
  },
  {
    title: "Profile",
    href: "/portal/profile",
    icon: UserRound,
    description: "Your candidate profile and resume",
  },
  {
    title: "Settings",
    href: "/portal/settings",
    icon: Settings,
    description: "Notification preferences",
  },
]

/** Recruiter console navigation */
export const recruiterNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Hiring overview and live activity",
  },
  {
    title: "Jobs",
    href: "/jobs",
    icon: BriefcaseBusiness,
    description: "Open roles across companies",
  },
  {
    title: "Companies",
    href: "/companies",
    icon: Building2,
    description: "Employers and hiring brands",
  },
  {
    title: "Candidates",
    href: "/candidates",
    icon: Users,
    description: "Browse and manage candidate pipeline",
  },
  {
    title: "Resumes",
    href: "/resumes",
    icon: FileText,
    description: "Uploaded candidate resumes",
  },
  {
    title: "Resume Screening",
    href: "/screening",
    icon: ScanSearch,
    description: "Compare resumes with job descriptions",
  },
  {
    title: "AI Assistant",
    href: "/assistant",
    icon: Bot,
    description: "Hiring Q&A and interview scheduling",
  },
  {
    title: "Interviews",
    href: "/interviews",
    icon: CalendarDays,
    description: "Schedule and track interviews",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Funnel, match scores, and hiring trends",
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    description: "In-app alerts and delivery history",
  },
  {
    title: "Profile",
    href: "/profile",
    icon: UserRound,
    description: "Your account and recruiter details",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Notification preferences",
  },
]

/** Admin console navigation */
export const adminNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Platform overview",
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
    description: "Manage all platform accounts",
  },
  {
    title: "Recruiters",
    href: "/recruiters",
    icon: UserRoundSearch,
    description: "Recruiter performance and availability",
  },
  {
    title: "Candidates",
    href: "/candidates",
    icon: Users,
    description: "Browse and manage candidate pipeline",
  },
  {
    title: "Jobs",
    href: "/jobs",
    icon: BriefcaseBusiness,
    description: "Open roles across all companies",
  },
  {
    title: "Companies",
    href: "/companies",
    icon: Building2,
    description: "Employers and hiring brands",
  },
  {
    title: "Resumes",
    href: "/resumes",
    icon: FileText,
    description: "Uploaded candidate resumes",
  },
  {
    title: "Resume Screening",
    href: "/screening",
    icon: ScanSearch,
    description: "Compare resumes with job descriptions",
  },
  {
    title: "AI Assistant",
    href: "/assistant",
    icon: Bot,
    description: "Hiring Q&A and interview scheduling",
  },
  {
    title: "Interviews",
    href: "/interviews",
    icon: CalendarDays,
    description: "Schedule and track interviews",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Funnel, match scores, and hiring trends",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileBarChart,
    description: "Exportable hiring and activity reports",
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    description: "System alerts and delivery history",
  },
  {
    title: "Profile",
    href: "/profile",
    icon: UserRound,
    description: "Your admin account",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Notification preferences",
  },
]

/** @deprecated Use navForRole — kept for any legacy imports */
export const mainNav = adminNav

export const appName = "HirePulse"
export const appTagline = "Recruitment Console"
export const candidateTagline = "Candidate Portal"

export function navForRole(role: UserRole | undefined | null): NavItem[] {
  switch (role) {
    case "admin":
      return adminNav
    case "recruiter":
      return recruiterNav
    case "candidate":
      return candidateNav
    default:
      return []
  }
}

export function getNavMeta(pathname: string, role?: UserRole | null) {
  const items = navForRole(role)
  const exact = items.find((item) => item.href === pathname)
  if (exact) return exact

  const ranked = [...items].sort((a, b) => b.href.length - a.href.length)
  return (
    ranked.find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`)
    ) ??
    items[0] ?? {
      title: "HirePulse",
      href: "/",
      icon: LayoutDashboard,
      description: "",
    }
  )
}
