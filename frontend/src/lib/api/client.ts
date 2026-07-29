import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios"

import { env } from "@/config/env"
import { toApiError } from "@/lib/api/errors"
import { apiLoading } from "@/lib/api/loading"
import { sharedRefresh } from "@/lib/auth-refresh"
import { authStorage } from "@/lib/auth-storage"

/** Shared Axios instance — base URL from env */
export const api: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.skipLoading) {
    apiLoading.start()
  }

  if (!config.skipAuth) {
    const token = authStorage.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  // Let the browser set multipart boundary for FormData bodies
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    if (config.headers && "Content-Type" in config.headers) {
      delete (config.headers as Record<string, unknown>)["Content-Type"]
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    if (!response.config.skipLoading) {
      apiLoading.stop()
    }
    return response
  },
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined

    if (config && !config.skipLoading) {
      apiLoading.stop()
    }

    if (
      config &&
      error.response?.status === 401 &&
      !config.skipAuthRefresh &&
      !config._retry &&
      !config.skipAuth
    ) {
      config._retry = true
      const tokens = await sharedRefresh()

      if (tokens?.access_token) {
        config.headers.Authorization = `Bearer ${tokens.access_token}`
        return api.request(config)
      }

      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        await authStorage.clear().catch(() => undefined)
        window.location.href = "/login"
      }
    }

    return Promise.reject(await toApiError(error))
  }
)

/** Typed helpers used by centralized service modules */
export const apiClient = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return api.get<T>(url, config).then((res) => res.data)
  },

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return api.post<T>(url, data, config).then((res) => res.data)
  },

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return api.put<T>(url, data, config).then((res) => res.data)
  },

  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return api.patch<T>(url, data, config).then((res) => res.data)
  },

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return api.delete<T>(url, config).then((res) => res.data)
  },
}
