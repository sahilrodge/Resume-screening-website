"use client"

import { AppNavbar } from "@/components/layout/app-navbar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AuthLoading } from "@/components/shared/auth-loading"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/features/auth/auth-provider"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { loading, isAuthenticated, user } = useAuth()

  if (loading || !isAuthenticated || user?.role !== "candidate") {
    return <AuthLoading />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh">
        <AppNavbar />
        <div className="flex-1 px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
