/** Single-flight refresh shared by Axios interceptor and AuthProvider. */

import axios from "axios"

import { env } from "@/config/env"
import { authStorage } from "@/lib/auth-storage"
import type { TokenPair } from "@/types/auth"

let refreshPromise: Promise<TokenPair | null> | null = null

async function doRefresh(): Promise<TokenPair | null> {
  const refreshToken = authStorage.getRefreshToken()
  if (!refreshToken) {
    // Drop orphan middleware cookie so /login is not bounced by stale RBAC.
    await authStorage.clear()
    return null
  }
  if (authStorage.isRefreshExpired()) {
    await authStorage.clear()
    return null
  }

  try {
    const { data } = await axios.post<TokenPair>(
      `${env.apiUrl}/auth/refresh`,
      {
        refresh_token: refreshToken,
        remember_me: authStorage.getRememberMe(),
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    )
    await authStorage.setTokens(data)
    return data
  } catch {
    await authStorage.clear()
    return null
  }
}

/** Deduplicated refresh — concurrent callers share one request. */
export function sharedRefresh(): Promise<TokenPair | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}
