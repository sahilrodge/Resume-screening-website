import { apiClient } from "@/lib/api"
import type { UserRole } from "@/types/auth"

export type AdminUser = {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  is_super_admin?: boolean
  company_name: string | null
  last_login: string | null
  created_at: string
  updated_at: string
}

export type AdminUserListResponse = {
  items: AdminUser[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type AdminUserListParams = {
  page?: number
  page_size?: number
  role?: UserRole
  search?: string
  status?: "all" | "active" | "suspended"
  is_active?: boolean
}

export const usersApi = {
  list(params?: AdminUserListParams) {
    return apiClient.get<AdminUserListResponse>("/users", { params })
  },

  get(id: string) {
    return apiClient.get<AdminUser>(`/users/${id}`)
  },

  create(payload: {
    email: string
    password: string
    full_name: string
    role: UserRole
    company_name?: string
  }) {
    return apiClient.post<AdminUser>("/users", payload)
  },

  update(
    id: string,
    payload: {
      full_name?: string
      email?: string
      role?: UserRole
      is_active?: boolean
      company_name?: string | null
    }
  ) {
    return apiClient.patch<AdminUser>(`/users/${id}`, payload)
  },

  suspend(id: string) {
    return apiClient.post<AdminUser>(`/users/${id}/suspend`, {})
  },

  activate(id: string) {
    return apiClient.post<AdminUser>(`/users/${id}/activate`, {})
  },

  resetPassword(id: string, new_password: string) {
    return apiClient.post<{ message: string }>(`/users/${id}/reset-password`, {
      new_password,
    })
  },

  remove(id: string) {
    return apiClient.delete<{ message: string }>(`/users/${id}`)
  },
}
