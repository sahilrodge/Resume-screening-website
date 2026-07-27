"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"

import {
  appName,
  appTagline,
  candidateTagline,
  navForRole,
} from "@/config/navigation"
import { useAuth } from "@/features/auth/auth-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

function isNavActive(pathname: string, href: string, homeHref: string) {
  if (pathname === href) return true
  // Home items should not stay active on every nested route
  if (href === homeHref) return false
  return pathname.startsWith(`${href}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const items = navForRole(user?.role)
  const isCandidate = user?.role === "candidate"
  const homeHref = isCandidate ? "/portal" : "/dashboard"
  const tagline = isCandidate ? candidateTagline : appTagline
  const groupLabel =
    user?.role === "admin"
      ? "Admin"
      : user?.role === "recruiter"
        ? "Recruiter"
        : "Candidate"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link href={homeHref} className="flex items-center gap-2.5 overflow-hidden">
          <motion.span
            whileHover={{ scale: 1.05, rotate: -3 }}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
          >
            <Sparkles className="size-4" />
          </motion.span>
          <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-heading text-sm font-semibold tracking-tight">
              {appName}
            </span>
            <span className="truncate text-xs text-muted-foreground">{tagline}</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            {groupLabel}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isNavActive(pathname, item.href, homeHref)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        <span className="capitalize">{user?.role ?? "guest"} access</span>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
