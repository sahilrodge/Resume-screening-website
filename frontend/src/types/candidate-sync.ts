import type { ApplicationMatch } from "@/types/application"
import type { Job } from "@/types/job"
import type { AppNotification } from "@/types/notification"
import type { Profile } from "@/types/profile"
import type { Resume } from "@/types/resume"
import type { Interview } from "@/services/interviews"

/** Single-source candidate portal snapshot from GET /candidates/me/overview */
export type CandidateOverview = {
  profile: Profile
  resumes: Resume[]
  resumes_total: number
  applications: ApplicationMatch[]
  applications_total: number
  saved_jobs: Job[]
  saved_jobs_total: number
  saved_job_ids: string[]
  interviews: Interview[]
  interviews_total: number
  notifications: AppNotification[]
  notifications_total: number
  unread_notifications: number
}
