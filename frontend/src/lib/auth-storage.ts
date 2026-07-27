import type { TokenPair, User } from "@/types/auth"
import {
  SESSION_BROWSER_MAX_AGE_SECONDS,
  SESSION_REMEMBER_MAX_AGE_SECONDS,
} from "@/lib/auth-roles"

const ACCESS_KEY = "hirepulse_access_token"
const REFRESH_KEY = "hirepulse_refresh_token"
const USER_KEY = "hirepulse_user"
const REMEMBER_KEY = "hirepulse_remember_me"
const ACCESS_EXP_KEY = "hirepulse_access_expires_at"
const REFRESH_EXP_KEY = "hirepulse_refresh_expires_at"

function canUseStorage() {
  return typeof window !== "undefined"
}

function primaryStore(remember: boolean): Storage {
  return remember ? window.localStorage : window.sessionStorage
}

function allStores(): Storage[] {
  if (!canUseStorage()) return []
  return [window.localStorage, window.sessionStorage]
}

function readFromStores(key: string): string | null {
  if (!canUseStorage()) return null
  return (
    window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
  )
}

function writeKeys(
  remember: boolean,
  entries: Record<string, string>
) {
  const store = primaryStore(remember)
  const other = remember ? window.sessionStorage : window.localStorage
  Object.entries(entries).forEach(([key, value]) => {
    store.setItem(key, value)
    other.removeItem(key)
  })
}

function removeKeys(keys: string[]) {
  allStores().forEach((store) => {
    keys.forEach((key) => store.removeItem(key))
  })
}

async function syncServerSession(
  accessToken: string | null,
  options?: { rememberMe?: boolean; maxAgeSeconds?: number }
) {
  if (!canUseStorage()) return
  if (accessToken) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        remember_me: options?.rememberMe ?? getRememberMe(),
        max_age_seconds: options?.maxAgeSeconds,
      }),
    })
    if (!res.ok) {
      throw new Error("Failed to establish secure session. Check AUTH_SECRET.")
    }
  } else {
    await fetch("/api/auth/session", { method: "DELETE" })
  }
}

function getRememberMe(): boolean {
  if (!canUseStorage()) return false
  return readFromStores(REMEMBER_KEY) === "1"
}

function expiryFromTokens(tokens: TokenPair) {
  const now = Date.now()
  const accessExpiresAt = now + Math.max(tokens.expires_in, 60) * 1000
  const refreshExpiresAt =
    now + Math.max(tokens.refresh_expires_in, 60) * 1000
  return { accessExpiresAt, refreshExpiresAt }
}

export const authStorage = {
  getRememberMe,

  getAccessToken(): string | null {
    return readFromStores(ACCESS_KEY)
  },

  getRefreshToken(): string | null {
    return readFromStores(REFRESH_KEY)
  },

  getUser(): User | null {
    const raw = readFromStores(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  },

  getAccessExpiresAt(): number | null {
    const raw = readFromStores(ACCESS_EXP_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  },

  getRefreshExpiresAt(): number | null {
    const raw = readFromStores(REFRESH_EXP_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  },

  isRefreshExpired(): boolean {
    const exp = this.getRefreshExpiresAt()
    if (!exp) return !this.getRefreshToken()
    return Date.now() >= exp
  },

  shouldRefreshAccess(skewMs = 60_000): boolean {
    const exp = this.getAccessExpiresAt()
    if (!exp) return Boolean(this.getRefreshToken())
    return Date.now() >= exp - skewMs
  },

  async setSession(user: User, tokens: TokenPair) {
    if (!canUseStorage()) return
    const remember = Boolean(tokens.remember_me)
    const { accessExpiresAt, refreshExpiresAt } = expiryFromTokens(tokens)
    writeKeys(remember, {
      [ACCESS_KEY]: tokens.access_token,
      [REFRESH_KEY]: tokens.refresh_token,
      [USER_KEY]: JSON.stringify(user),
      [REMEMBER_KEY]: remember ? "1" : "0",
      [ACCESS_EXP_KEY]: String(accessExpiresAt),
      [REFRESH_EXP_KEY]: String(refreshExpiresAt),
    })
    try {
      await syncServerSession(tokens.access_token, {
        rememberMe: remember,
        maxAgeSeconds: remember
          ? SESSION_REMEMBER_MAX_AGE_SECONDS
          : SESSION_BROWSER_MAX_AGE_SECONDS,
      })
    } catch (err) {
      removeKeys([
        ACCESS_KEY,
        REFRESH_KEY,
        USER_KEY,
        REMEMBER_KEY,
        ACCESS_EXP_KEY,
        REFRESH_EXP_KEY,
      ])
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined)
      throw err
    }
  },

  async setTokens(tokens: TokenPair) {
    if (!canUseStorage()) return
    const remember =
      tokens.remember_me !== undefined
        ? Boolean(tokens.remember_me)
        : getRememberMe()
    const user = this.getUser()
    const { accessExpiresAt, refreshExpiresAt } = expiryFromTokens(tokens)
    const entries: Record<string, string> = {
      [ACCESS_KEY]: tokens.access_token,
      [REFRESH_KEY]: tokens.refresh_token,
      [REMEMBER_KEY]: remember ? "1" : "0",
      [ACCESS_EXP_KEY]: String(accessExpiresAt),
      [REFRESH_EXP_KEY]: String(refreshExpiresAt),
    }
    if (user) entries[USER_KEY] = JSON.stringify(user)
    writeKeys(remember, entries)
    try {
      await syncServerSession(tokens.access_token, {
        rememberMe: remember,
        maxAgeSeconds: remember
          ? SESSION_REMEMBER_MAX_AGE_SECONDS
          : SESSION_BROWSER_MAX_AGE_SECONDS,
      })
    } catch (err) {
      removeKeys([
        ACCESS_KEY,
        REFRESH_KEY,
        USER_KEY,
        REMEMBER_KEY,
        ACCESS_EXP_KEY,
        REFRESH_EXP_KEY,
      ])
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined)
      throw err
    }
  },

  async setUser(user: User) {
    if (!canUseStorage()) return
    const remember = getRememberMe()
    writeKeys(remember, { [USER_KEY]: JSON.stringify(user) })
    const token = this.getAccessToken()
    if (token) {
      try {
        await syncServerSession(token, { rememberMe: remember })
      } catch {
        // ignore soft resync failures
      }
    }
  },

  async clear() {
    if (!canUseStorage()) return
    removeKeys([
      ACCESS_KEY,
      REFRESH_KEY,
      USER_KEY,
      REMEMBER_KEY,
      ACCESS_EXP_KEY,
      REFRESH_EXP_KEY,
    ])
    await syncServerSession(null)
  },
}
