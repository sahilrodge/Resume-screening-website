import type { Metadata } from "next"
import { Manrope, Sora } from "next/font/google"

import { AppProviders } from "@/components/providers/app-providers"

import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
})

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
})

export const metadata: Metadata = {
  title: {
    default: "HirePulse | AI Recruitment",
    template: "%s | HirePulse",
  },
  description: "Production-ready AI recruitment management dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${sora.variable} font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
