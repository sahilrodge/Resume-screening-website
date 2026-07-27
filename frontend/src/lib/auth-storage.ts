import type { TokenPair, User } from "@/types/auth"

const ACCESS_KEY = "hirepulse_access_token"
const REFRESH_KEY = "hirepulse_refresh_token"
const USER_KEY = "hirepulse_user"

function canUseStorage() {
  return typeof window !== "undefined"
}

export const authStorage = {
  getAccessToken(): string | null {
    if (!canUseStorage()) return null
    return localStorage.getItem(ACCESS_KEY)
  },

  getRefreshToken(): string | null {
    if (!canUseStorage()) return null
    return localStorage.getItem(REFRESH_KEY)
  },

  getUser(): User | null {
    if (!canUseStorage()) return null
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  },

  setSession(user: User, tokens: TokenPair) {
    if (!canUseStorage()) return
    localStorage.setItem(ACCESS_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  setTokens(tokens: TokenPair) {
    if (!canUseStorage()) return
    localStorage.setItem(ACCESS_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
  },

  clear() {
    if (!canUseStorage()) return
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
