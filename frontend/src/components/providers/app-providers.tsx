"use client"

import * as React from "react"

import { AuthProvider } from "@/features/auth/auth-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ApiLoadingBar } from "@/components/shared/api-loading-bar"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delay={200}>
        <AuthProvider>
          <ApiLoadingBar />
          {children}
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
