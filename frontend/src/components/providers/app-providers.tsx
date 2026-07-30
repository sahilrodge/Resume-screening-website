"use client"

import * as React from "react"

import { AuthProvider } from "@/features/auth/auth-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ApiLoadingBar } from "@/components/shared/api-loading-bar"
import { ToastProvider } from "@/components/shared/toast"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="hirepulse-theme"
      disableTransitionOnChange
    >
      <TooltipProvider delay={200}>
        <AuthProvider>
          <ToastProvider>
            <ApiLoadingBar />
            {children}
          </ToastProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
