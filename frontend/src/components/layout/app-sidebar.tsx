"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { motion } from "framer-motion"

import {
  appName,
  appTagline,
  candidateTagline,
  navForRole,
} from "@/config/navigation"
import { useAuth } from "@/features/auth/auth-provider"
import { HirePulseMark } from "@/components/brand/hirepulse-mark"
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
  useSidebar,
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
  const { isMobile, setOpenMobile } = useSidebar()
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

  // Close the mobile sheet after any route change (back/forward, same-item, etc.)
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  function closeMobileSidebar() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4 md:pr-3 pr-12">
        <Link
          href={homeHref}
          onClick={closeMobileSidebar}
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <motion.span whileHover={{ scale: 1.05, rotate: -3 }} className="shrink-0">
            <HirePulseMark size="sm" className="size-8 rounded-lg border-transparent" />
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
                      onClick={closeMobileSidebar}
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
