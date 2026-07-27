export type Company = {
  id: string
  name: string
  description: string | null
  website: string | null
  industry: string | null
  location: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}

export type CompanyListResponse = {
  items: Company[]
  total: number
}

export type CompanyCreatePayload = {
  name: string
  description?: string
  website?: string
  industry?: string
  location?: string
}
