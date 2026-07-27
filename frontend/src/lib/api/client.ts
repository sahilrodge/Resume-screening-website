import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios"

import { env } from "@/config/env"
import { toApiError } from "@/lib/api/errors"
import { apiLoading } from "@/lib/api/loading"
import { authStorage } from "@/lib/auth-storage"
import type { TokenPair } from "@/types/auth"

/** Shared Axios instance — base URL from env */
export const api: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken()
  if (!refreshToken) return null

  try {
    const { data } = await axios.post<TokenPair>(
      `${env.apiUrl}/auth/refresh`,
      { refresh_token: refreshToken },
      {
        headers: { "Content-Type": "application/json" },
        // plain axios — avoid interceptor recursion
      }
    )
    authStorage.setTokens(data)
    return data.access_token
  } catch {
    authStorage.clear()
    return null
  }
}

function queueRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

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
      const accessToken = await queueRefresh()

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
        return api.request(config)
      }

      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }

    return Promise.reject(toApiError(error))
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
