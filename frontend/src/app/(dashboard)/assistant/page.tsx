"use client"

import { useEffect, useState } from "react"

import { FadeIn, PageTransition } from "@/components/motion/page-transition"
import { useAuth } from "@/features/auth/auth-provider"
import { AssistantChat } from "@/features/assistant/assistant-chat"
import { candidatesApi } from "@/services/candidates"
import { jobsApi } from "@/services/jobs"

export default function AssistantPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [jobOptions, setJobOptions] = useState<{ id: string; label: string }[]>(
    []
  )
  const [candidateOptions, setCandidateOptions] = useState<
    { id: string; label: string }[]
  >([])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      jobsApi.list({ page: 1, page_size: 50, status: "open" }),
      candidatesApi.list({ page: 1, page_size: 50 }),
    ])
      .then(([jobs, candidates]) => {
        if (cancelled) return
        setJobOptions(
          jobs.items.map((j) => ({
            id: j.id,
            label: j.company_name
              ? `${j.company_name} - ${j.title}`
              : j.title,
          }))
        )
        setCandidateOptions(
          candidates.items.map((c) => ({
            id: c.id,
            label: c.full_name,
          }))
        )
      })
      .catch(() => {
        // Context selectors are optional; chat still works without them.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PageTransition>
      <FadeIn>
        <AssistantChat
          mode={isAdmin ? "admin" : "recruiter"}
          title={isAdmin ? "Platform Insights Assistant" : "Recruitment Assistant"}
          description={
            isAdmin
              ? "Ask about analytics, hiring funnel health, job performance, and platform insights. Chat history is saved."
              : "Get hiring suggestions, compare candidates, generate job descriptions, and schedule interviews. Chat history is saved."
          }
          emptyHint={
            isAdmin
              ? "Start a chat to explore KPIs, funnel bottlenecks, and operational recommendations."
              : "Optionally pick a job and candidate, then ask for hiring plans, comparisons, or a job description draft."
          }
          inputPlaceholder={
            isAdmin
              ? "Ask about analytics, funnel health, or platform insights…"
              : "Ask for hiring suggestions, candidate comparison, or a job description…"
          }
          showContextControls
          jobOptions={jobOptions}
          candidateOptions={candidateOptions}
        />
      </FadeIn>
    </PageTransition>
  )
}
