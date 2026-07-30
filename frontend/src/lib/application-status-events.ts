import type { ApplicationStatus } from "@/types/application"

export type ApplicationStatusChange = {
  applicationId: string
  status: ApplicationStatus
  interviewId?: string
}

type Listener = (change: ApplicationStatusChange) => void

const listeners = new Set<Listener>()

/** Publish when interview/application status changes so every open view can refresh. */
export function publishApplicationStatusChange(change: ApplicationStatusChange) {
  listeners.forEach((listener) => {
    try {
      listener(change)
    } catch {
      // Ignore subscriber errors so one bad view cannot break others.
    }
  })
}

export function subscribeApplicationStatusChange(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
