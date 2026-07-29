export type UserRole = "admin" | "recruiter" | "candidate"

export type User = {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export type TokenPair = {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  refresh_expires_in: number
  remember_me: boolean
}

export type EmailVerificationPlaceholder = {
  status: "pending"
  required: boolean
  message: string
}

export type AuthResponse = {
  user: User
  tokens: TokenPair
  email_verification?: EmailVerificationPlaceholder
}

export type LoginPayload = {
  email: string
  password: string
  remember_me?: boolean
}

export type RegisterPayload = {
  email: string
  password: string
  full_name: string
  confirm_password?: string
  company_name?: string
  job_title?: string
  phone?: string
  remember_me?: boolean
}
