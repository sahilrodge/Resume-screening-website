"use client"

import { AppNavbar } from "@/components/layout/app-navbar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AuthLoading } from "@/components/shared/auth-loading"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/features/auth/auth-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { loading, isAuthenticated, user } = useAuth()

  if (loading || !isAuthenticated) {
    return <AuthLoading />
  }

  if (user?.role === "candidate") {
    return <AuthLoading />
  }

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset className="min-h-svh">
        <AppNavbar />
        <div
          id="main-content"
          className="flex-1 px-4 py-5 sm:py-6 md:px-6 lg:px-8"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
