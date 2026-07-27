import { apiClient } from "@/lib/api"
import type { User, UserRole } from "@/types/auth"

export type AdminUserListResponse = {
  items: User[]
  total: number
  page: number
  page_size: number
  pages: number
}

export const usersApi = {
  list(params?: {
    page?: number
    page_size?: number
    role?: UserRole
    search?: string
  }) {
    return apiClient.get<AdminUserListResponse>("/users", { params })
  },

  create(payload: {
    email: string
    password: string
    full_name: string
    role: UserRole
  }) {
    return apiClient.post<User>("/users", payload)
  },

  update(
    id: string,
    payload: { full_name?: string; role?: UserRole; is_active?: boolean }
  ) {
    return apiClient.patch<User>(`/users/${id}`, payload)
  },
}
