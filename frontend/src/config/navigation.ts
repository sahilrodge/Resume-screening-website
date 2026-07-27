import {
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  FileText,
  LayoutDashboard,
  MessageCircle,
  PhoneCall,
  ScanSearch,
  Settings,
  UserRoundSearch,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description: string
}

export const mainNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Hiring overview and live activity",
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
    description: "Upload, preview, and download PDF resumes",
  },
  {
    title: "AI Screening",
    href: "/screening",
    icon: ScanSearch,
    description: "Compare resumes with job descriptions",
  },
  {
    title: "WhatsApp",
    href: "/whatsapp",
    icon: MessageCircle,
    description: "Twilio WhatsApp messages and replies",
  },
  {
    title: "AI Voice",
    href: "/voice-calls",
    icon: PhoneCall,
    description: "Vapi screening calls and scores",
  },
  {
    title: "Assistant",
    href: "/assistant",
    icon: Bot,
    description: "Answer questions, explain jobs, schedule interviews",
  },
  {
    title: "Recruiters",
    href: "/recruiters",
    icon: UserRoundSearch,
    description: "Recruiter performance and availability",
  },
  {
    title: "Companies",
    href: "/companies",
    icon: Building2,
    description: "Employer accounts and open roles",
  },
  {
    title: "Jobs",
    href: "/jobs",
    icon: BriefcaseBusiness,
    description: "Open roles across all companies",
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
    description: "Email, WhatsApp, in-app, push, and history",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Workspace preferences and access",
  },
]

export const appName = "HirePulse"
export const appTagline = "Admin Console"

export function getNavMeta(pathname: string) {
  const exact = mainNav.find((item) => item.href === pathname)
  if (exact) return exact
  return (
    mainNav.find((item) => pathname.startsWith(`${item.href}/`)) ?? mainNav[0]
  )
}
