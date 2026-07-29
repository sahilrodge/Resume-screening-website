"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { candidatesApi } from "@/services/candidates"
import type { ApplicationMatch } from "@/types/application"
import type { CandidateOverview } from "@/types/candidate-sync"
import type { Job } from "@/types/job"
import type { AppNotification } from "@/types/notification"
import type { Profile } from "@/types/profile"
import type { Resume } from "@/types/resume"
import type { Interview } from "@/services/interviews"
import { ApiError } from "@/types/api"

type CandidateSyncValue = {
  loading: boolean
  refreshing: boolean
  error: string | null
  syncedAt: number | null
  profile: Profile | null
  resumes: Resume[]
  resumesTotal: number
  hasResume: boolean
  applications: ApplicationMatch[]
  applicationsTotal: number
  savedJobs: Job[]
  savedJobsTotal: number
  savedJobIds: Set<string>
  interviews: Interview[]
  interviewsTotal: number
  notifications: AppNotification[]
  notificationsTotal: number
  unreadCount: number
  /** Full refresh from GET /candidates/me/overview */
  refresh: (opts?: { silent?: boolean }) => Promise<CandidateOverview | null>
  /** Keep profile in sync after PATCH without a full refetch */
  setProfile: (profile: Profile) => void
  /** Optimistic helpers for common mutations */
  markJobSaved: (jobId: string, saved: boolean) => void
  setUnreadCount: (count: number) => void
  setNotifications: (items: AppNotification[]) => void
}

const CandidateSyncContext = createContext<CandidateSyncValue | null>(null)

function applyOverview(
  data: CandidateOverview,
  setters: {
    setProfile: (p: Profile) => void
    setResumes: (r: Resume[]) => void
    setResumesTotal: (n: number) => void
    setApplications: (a: ApplicationMatch[]) => void
    setApplicationsTotal: (n: number) => void
    setSavedJobs: (j: Job[]) => void
    setSavedJobsTotal: (n: number) => void
    setSavedJobIds: (ids: Set<string>) => void
    setInterviews: (i: Interview[]) => void
    setInterviewsTotal: (n: number) => void
    setNotifications: (n: AppNotification[]) => void
    setNotificationsTotal: (n: number) => void
    setUnreadCount: (n: number) => void
    setSyncedAt: (t: number) => void
  }
) {
  setters.setProfile(data.profile)
  setters.setResumes(data.resumes ?? [])
  setters.setResumesTotal(data.resumes_total ?? 0)
  setters.setApplications(data.applications ?? [])
  setters.setApplicationsTotal(data.applications_total ?? 0)
  setters.setSavedJobs(data.saved_jobs ?? [])
  setters.setSavedJobsTotal(data.saved_jobs_total ?? 0)
  setters.setSavedJobIds(new Set(data.saved_job_ids ?? []))
  setters.setInterviews(data.interviews ?? [])
  setters.setInterviewsTotal(data.interviews_total ?? 0)
  setters.setNotifications(data.notifications ?? [])
  setters.setNotificationsTotal(data.notifications_total ?? 0)
  setters.setUnreadCount(data.unread_notifications ?? 0)
  setters.setSyncedAt(Date.now())
}

export function CandidateSyncProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumesTotal, setResumesTotal] = useState(0)
  const [applications, setApplications] = useState<ApplicationMatch[]>([])
  const [applicationsTotal, setApplicationsTotal] = useState(0)
  const [savedJobs, setSavedJobs] = useState<Job[]>([])
  const [savedJobsTotal, setSavedJobsTotal] = useState(0)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [interviewsTotal, setInterviewsTotal] = useState(0)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationsTotal, setNotificationsTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const inFlight = useRef<Promise<CandidateOverview | null> | null>(null)
  const mounted = useRef(true)
  const hasLoaded = useRef(false)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (inFlight.current) return inFlight.current

    const silent = opts?.silent ?? hasLoaded.current
    if (silent) setRefreshing(true)
    else setLoading(true)

    const task = candidatesApi
      .overview()
      .then((data) => {
        if (!mounted.current) return data
        applyOverview(data, {
          setProfile,
          setResumes,
          setResumesTotal,
          setApplications,
          setApplicationsTotal,
          setSavedJobs,
          setSavedJobsTotal,
          setSavedJobIds,
          setInterviews,
          setInterviewsTotal,
          setNotifications,
          setNotificationsTotal,
          setUnreadCount,
          setSyncedAt,
        })
        hasLoaded.current = true
        setError(null)
        return data
      })
      .catch((err) => {
        if (mounted.current) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to sync candidate data."
          )
        }
        return null
      })
      .finally(() => {
        inFlight.current = null
        if (mounted.current) {
          setLoading(false)
          setRefreshing(false)
        }
      })

    inFlight.current = task
    return task
  }, [])

  useEffect(() => {
    mounted.current = true
    void refresh({ silent: false })
    return () => {
      mounted.current = false
    }
    // Initial load only — subsequent refreshes are explicit / window focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onFocus() {
      void refresh({ silent: true })
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refresh])

  const markJobSaved = useCallback((jobId: string, saved: boolean) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev)
      if (saved) next.add(jobId)
      else next.delete(jobId)
      return next
    })
    setSavedJobsTotal((prev) => {
      if (saved) return prev + 1
      return Math.max(0, prev - 1)
    })
    if (!saved) {
      setSavedJobs((prev) => prev.filter((job) => job.id !== jobId))
    }
  }, [])

  const value = useMemo<CandidateSyncValue>(
    () => ({
      loading,
      refreshing,
      error,
      syncedAt,
      profile,
      resumes,
      resumesTotal,
      hasResume: resumesTotal > 0 || resumes.length > 0 || Boolean(profile?.resume_id),
      applications,
      applicationsTotal,
      savedJobs,
      savedJobsTotal,
      savedJobIds,
      interviews,
      interviewsTotal,
      notifications,
      notificationsTotal,
      unreadCount,
      refresh,
      setProfile,
      markJobSaved,
      setUnreadCount,
      setNotifications,
    }),
    [
      loading,
      refreshing,
      error,
      syncedAt,
      profile,
      resumes,
      resumesTotal,
      applications,
      applicationsTotal,
      savedJobs,
      savedJobsTotal,
      savedJobIds,
      interviews,
      interviewsTotal,
      notifications,
      notificationsTotal,
      unreadCount,
      refresh,
      markJobSaved,
    ]
  )

  return (
    <CandidateSyncContext.Provider value={value}>
      {children}
    </CandidateSyncContext.Provider>
  )
}

export function useCandidateSync(): CandidateSyncValue {
  const ctx = useContext(CandidateSyncContext)
  if (!ctx) {
    throw new Error("useCandidateSync must be used within CandidateSyncProvider")
  }
  return ctx
}

export function useCandidateSyncOptional(): CandidateSyncValue | null {
  return useContext(CandidateSyncContext)
}
