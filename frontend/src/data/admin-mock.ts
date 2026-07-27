export type CandidateRow = {
  id: string
  name: string
  email: string
  role: string
  location: string
  experience: string
  match: number
  status: "New" | "Screening" | "Shortlisted" | "Interview" | "Hired" | "Rejected"
}

export type RecruiterRow = {
  id: string
  name: string
  email: string
  company: string
  openJobs: number
  hires: number
  status: "Active" | "Away" | "Inactive"
}

export type CompanyRow = {
  id: string
  name: string
  industry: string
  location: string
  employees: string
  openRoles: number
  status: "Active" | "Trial" | "Paused"
}

export type JobRow = {
  id: string
  title: string
  company: string
  location: string
  type: "Full-time" | "Contract" | "Remote" | "Internship"
  applicants: number
  status: "Open" | "Draft" | "Closed" | "Filled"
  posted: string
}

export type NotificationRow = {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "alert"
  time: string
  read: boolean
}

export const dashboardStats = [
  { title: "Total candidates", value: "2,847", delta: "+18% this month", trend: "up" as const },
  { title: "Active recruiters", value: "64", delta: "+5 new this week", trend: "up" as const },
  { title: "Open positions", value: "128", delta: "12 closing soon", trend: "neutral" as const },
  { title: "Hire rate", value: "23.4%", delta: "+2.1% vs last quarter", trend: "up" as const },
]

export const pipelineChart = [
  { month: "Jan", applications: 420, hires: 38, interviews: 112 },
  { month: "Feb", applications: 510, hires: 44, interviews: 136 },
  { month: "Mar", applications: 580, hires: 51, interviews: 148 },
  { month: "Apr", applications: 640, hires: 49, interviews: 162 },
  { month: "May", applications: 720, hires: 61, interviews: 188 },
  { month: "Jun", applications: 810, hires: 73, interviews: 210 },
]

export const sourceChart = [
  { name: "LinkedIn", value: 38 },
  { name: "Referrals", value: 24 },
  { name: "Careers site", value: 21 },
  { name: "Agencies", value: 17 },
]

export const candidates: CandidateRow[] = [
  {
    id: "c1",
    name: "Ava Chen",
    email: "ava.chen@email.com",
    role: "Senior Frontend Engineer",
    location: "Singapore",
    experience: "7 yrs",
    match: 94,
    status: "Shortlisted",
  },
  {
    id: "c2",
    name: "Marcus Lee",
    email: "marcus.lee@email.com",
    role: "Product Designer",
    location: "Austin, TX",
    experience: "5 yrs",
    match: 88,
    status: "Interview",
  },
  {
    id: "c3",
    name: "Priya Nair",
    email: "priya.nair@email.com",
    role: "Backend Engineer",
    location: "Bengaluru",
    experience: "6 yrs",
    match: 91,
    status: "Screening",
  },
  {
    id: "c4",
    name: "Jonah Brooks",
    email: "jonah.brooks@email.com",
    role: "DevOps Engineer",
    location: "Remote",
    experience: "8 yrs",
    match: 86,
    status: "New",
  },
  {
    id: "c5",
    name: "Sofia Alvarez",
    email: "sofia.alvarez@email.com",
    role: "Data Analyst",
    location: "Madrid",
    experience: "4 yrs",
    match: 90,
    status: "Hired",
  },
  {
    id: "c6",
    name: "Kenji Sato",
    email: "kenji.sato@email.com",
    role: "Mobile Engineer",
    location: "Tokyo",
    experience: "5 yrs",
    match: 79,
    status: "Rejected",
  },
  {
    id: "c7",
    name: "Amelia Hart",
    email: "amelia.hart@email.com",
    role: "QA Lead",
    location: "London",
    experience: "9 yrs",
    match: 85,
    status: "Interview",
  },
  {
    id: "c8",
    name: "Diego Ramos",
    email: "diego.ramos@email.com",
    role: "Full Stack Engineer",
    location: "São Paulo",
    experience: "6 yrs",
    match: 87,
    status: "Screening",
  },
]

export const recruiters: RecruiterRow[] = [
  {
    id: "r1",
    name: "Helen Park",
    email: "helen@northwind.io",
    company: "Northwind Labs",
    openJobs: 8,
    hires: 21,
    status: "Active",
  },
  {
    id: "r2",
    name: "Omar Haddad",
    email: "omar@brightpath.com",
    company: "BrightPath",
    openJobs: 5,
    hires: 14,
    status: "Active",
  },
  {
    id: "r3",
    name: "Lina Ortega",
    email: "lina@orbitly.ai",
    company: "Orbitly AI",
    openJobs: 11,
    hires: 33,
    status: "Away",
  },
  {
    id: "r4",
    name: "Chris Nguyen",
    email: "chris@stackyard.co",
    company: "Stackyard",
    openJobs: 3,
    hires: 9,
    status: "Active",
  },
  {
    id: "r5",
    name: "Maya Singh",
    email: "maya@clearhire.com",
    company: "ClearHire",
    openJobs: 0,
    hires: 18,
    status: "Inactive",
  },
  {
    id: "r6",
    name: "Noah Klein",
    email: "noah@velvetsoft.io",
    company: "Velvet Soft",
    openJobs: 6,
    hires: 12,
    status: "Active",
  },
]

export const companies: CompanyRow[] = [
  {
    id: "co1",
    name: "Northwind Labs",
    industry: "SaaS",
    location: "San Francisco",
    employees: "201–500",
    openRoles: 14,
    status: "Active",
  },
  {
    id: "co2",
    name: "BrightPath",
    industry: "Fintech",
    location: "New York",
    employees: "51–200",
    openRoles: 9,
    status: "Active",
  },
  {
    id: "co3",
    name: "Orbitly AI",
    industry: "Artificial Intelligence",
    location: "Remote",
    employees: "11–50",
    openRoles: 17,
    status: "Trial",
  },
  {
    id: "co4",
    name: "Stackyard",
    industry: "Developer Tools",
    location: "Berlin",
    employees: "51–200",
    openRoles: 6,
    status: "Active",
  },
  {
    id: "co5",
    name: "ClearHire",
    industry: "HR Tech",
    location: "Toronto",
    employees: "11–50",
    openRoles: 2,
    status: "Paused",
  },
  {
    id: "co6",
    name: "Velvet Soft",
    industry: "E-commerce",
    location: "Amsterdam",
    employees: "201–500",
    openRoles: 11,
    status: "Active",
  },
]

export const jobs: JobRow[] = [
  {
    id: "j1",
    title: "Senior Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote",
    type: "Full-time",
    applicants: 142,
    status: "Open",
    posted: "2 days ago",
  },
  {
    id: "j2",
    title: "Staff Backend Engineer",
    company: "BrightPath",
    location: "New York, NY",
    type: "Full-time",
    applicants: 98,
    status: "Open",
    posted: "5 days ago",
  },
  {
    id: "j3",
    title: "Product Designer",
    company: "Orbitly AI",
    location: "Remote",
    type: "Contract",
    applicants: 76,
    status: "Open",
    posted: "1 week ago",
  },
  {
    id: "j4",
    title: "DevOps Engineer",
    company: "Stackyard",
    location: "Berlin",
    type: "Full-time",
    applicants: 54,
    status: "Draft",
    posted: "3 days ago",
  },
  {
    id: "j5",
    title: "Data Analyst",
    company: "Velvet Soft",
    location: "Amsterdam",
    type: "Remote",
    applicants: 121,
    status: "Filled",
    posted: "3 weeks ago",
  },
  {
    id: "j6",
    title: "Recruiting Coordinator",
    company: "ClearHire",
    location: "Toronto",
    type: "Internship",
    applicants: 33,
    status: "Closed",
    posted: "1 month ago",
  },
  {
    id: "j7",
    title: "AI Screening Specialist",
    company: "Northwind Labs",
    location: "San Francisco",
    type: "Full-time",
    applicants: 67,
    status: "Open",
    posted: "4 days ago",
  },
]

export const notifications: NotificationRow[] = [
  {
    id: "n1",
    title: "New high-match candidate",
    message: "Ava Chen scored 94% for Senior Frontend Engineer.",
    type: "success",
    time: "12 min ago",
    read: false,
  },
  {
    id: "n2",
    title: "Interview reminder",
    message: "Marcus Lee interview starts in 45 minutes.",
    type: "info",
    time: "38 min ago",
    read: false,
  },
  {
    id: "n3",
    title: "Job closing soon",
    message: "DevOps Engineer at Stackyard closes in 2 days.",
    type: "warning",
    time: "2 hours ago",
    read: false,
  },
  {
    id: "n4",
    title: "Company trial ending",
    message: "Orbitly AI trial expires in 5 days.",
    type: "alert",
    time: "Yesterday",
    read: true,
  },
  {
    id: "n5",
    title: "Weekly digest ready",
    message: "Your hiring analytics report for this week is available.",
    type: "info",
    time: "Yesterday",
    read: true,
  },
  {
    id: "n6",
    title: "Offer accepted",
    message: "Sofia Alvarez accepted the Data Analyst offer.",
    type: "success",
    time: "2 days ago",
    read: true,
  },
]

export const recentActivity = [
  { id: "a1", actor: "Helen Park", action: "shortlisted", target: "Ava Chen", time: "8m ago" },
  { id: "a2", actor: "Omar Haddad", action: "published", target: "Staff Backend Engineer", time: "26m ago" },
  { id: "a3", actor: "System", action: "screened", target: "48 new resumes", time: "1h ago" },
  { id: "a4", actor: "Lina Ortega", action: "scheduled interview with", target: "Marcus Lee", time: "2h ago" },
  { id: "a5", actor: "Chris Nguyen", action: "updated", target: "Stackyard company profile", time: "4h ago" },
]
