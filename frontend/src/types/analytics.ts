export type MonthPoint = {
  month: string
  label: string
  applications: number
  screened: number
}

export type FunnelStage = {
  status: string
  label: string
  count: number
}

export type HiringFunnel = {
  stages: FunnelStage[]
  rejected: number
  withdrawn: number
}

export type JobPerformanceItem = {
  job_id: string
  title: string
  status: string
  applications: number
  avg_match_score: number | null
  interviews: number
  hires: number
  openings: number
  fill_rate: number
}

export type RecruiterPerformanceItem = {
  recruiter_id: string
  user_id: string | null
  name: string
  jobs_owned: number
  open_jobs: number
  applications: number
  interviews: number
  hires: number
  avg_match_score: number | null
  avg_time_to_hire_days: number | null
}

export type MatchScoreBucket = {
  range: string
  count: number
}

export type MatchScoreMonth = {
  month: string
  label: string
  avg_score: number
  count: number
}

export type MatchScoreAnalytics = {
  avg_score: number | null
  scored_applications: number
  unscored_applications: number
  buckets: MatchScoreBucket[]
  by_month: MatchScoreMonth[]
}

export type StatusCount = {
  status: string
  label: string
  count: number
}

export type TypeCount = {
  interview_type: string
  label: string
  count: number
}

export type RatingBucket = {
  rating: number
  count: number
}

export type InterviewResults = {
  by_status: StatusCount[]
  by_type: TypeCount[]
  avg_rating: number | null
  rated_count: number
  rating_distribution: RatingBucket[]
}

export type MonthlyHiringPoint = {
  month: string
  label: string
  applications: number
  interviews: number
  offers: number
  hires: number
}

export type AnalyticsKpis = {
  total_applications: number
  total_hires: number
  open_jobs: number
  avg_match_score: number | null
  offer_accept_rate: number | null
  screen_to_interview_rate: number | null
  avg_time_to_hire_days: number | null
}

export type AnalyticsOverview = {
  kpis: AnalyticsKpis
  applications: MonthPoint[]
  hiring_funnel: HiringFunnel
  job_performance: JobPerformanceItem[]
  recruiter_performance: RecruiterPerformanceItem[]
  match_scores: MatchScoreAnalytics
  interview_results: InterviewResults
  monthly_hiring: MonthlyHiringPoint[]
}
