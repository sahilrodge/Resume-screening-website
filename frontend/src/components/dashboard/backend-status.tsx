"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react"

import { healthService } from "@/services/health"
import type { HealthResponse } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { env } from "@/config/env"

type Status = "loading" | "online" | "offline"

export function BackendStatus() {
  const [status, setStatus] = useState<Status>("loading")
  const [health, setHealth] = useState<HealthResponse | null>(null)

  useEffect(() => {
    let active = true

    async function check() {
      try {
        const data = await healthService.get()
        if (!active) return
        setHealth(data)
        setStatus("online")
      } catch {
        if (!active) return
        setHealth(null)
        setStatus("offline")
      }
    }

    check()
    const id = window.setInterval(check, 30000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  return (
    <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="font-heading text-base">Backend connection</CardTitle>
          {status === "loading" ? (
            <Badge variant="secondary" className="gap-1">
              <LoaderCircle className="size-3 animate-spin" />
              Checking
            </Badge>
          ) : null}
          {status === "online" ? (
            <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
              <CheckCircle2 className="size-3" />
              Online
            </Badge>
          ) : null}
          {status === "offline" ? (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="size-3" />
              Offline
            </Badge>
          ) : null}
        </div>
        <CardDescription className="truncate">{env.apiUrl}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        {health ? (
          <>
            <p>
              <span className="text-foreground">{health.app}</span> · v{health.version}
            </p>
            <p>Environment: {health.environment}</p>
          </>
        ) : (
          <p>Unable to reach FastAPI. Start the backend on port 8000.</p>
        )}
      </CardContent>
    </Card>
  )
}
