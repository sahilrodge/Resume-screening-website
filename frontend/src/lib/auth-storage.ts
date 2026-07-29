import type { TokenPair, User } from "@/types/auth"
import { SESSION_REMEMBER_MAX_AGE_SECONDS } from "@/lib/auth-roles"

const ACCESS_KEY = "hirepulse_access_token"
const REFRESH_KEY = "hirepulse_refresh_token"
const USER_KEY = "hirepulse_user"
const REMEMBER_KEY = "hirepulse_remember_me"
const ACCESS_EXP_KEY = "hirepulse_access_expires_at"
const REFRESH_EXP_KEY = "hirepulse_refresh_expires_at"

const ALL_KEYS = [
  ACCESS_KEY,
  REFRESH_KEY,
  USER_KEY,
  REMEMBER_KEY,
  ACCESS_EXP_KEY,
  REFRESH_EXP_KEY,
] as const

type AuthStorageGlobal = typeof globalThis & {
  __hirepulseSessionQueue?: Promise<unknown>
  __hirepulseSessionEpoch?: number
}

const g = globalThis as AuthStorageGlobal
if (!g.__hirepulseSessionQueue) {
  g.__hirepulseSessionQueue = Promise.resolve()
}
if (typeof g.__hirepulseSessionEpoch !== "number") {
  g.__hirepulseSessionEpoch = 0
}

/** Serialize session writes/clears across HMR/module duplicates via globalThis. */
async function enqueueSession<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("hirepulse-auth-session", task)
  }
  const previous = g.__hirepulseSessionQueue ?? Promise.resolve()
  const run = previous.then(task, task)
  g.__hirepulseSessionQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function bumpEpoch() {
  g.__hirepulseSessionEpoch = (g.__hirepulseSessionEpoch ?? 0) + 1
  return g.__hirepulseSessionEpoch
}

function currentEpoch() {
  return g.__hirepulseSessionEpoch ?? 0
}

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

function writeKeys(remember: boolean, entries: Record<string, string>) {
  const store = primaryStore(remember)
  const other = remember ? window.sessionStorage : window.localStorage
  Object.entries(entries).forEach(([key, value]) => {
    store.setItem(key, value)
    other.removeItem(key)
  })
}

function removeKeys(keys: readonly string[]) {
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
    const rememberMe = options?.rememberMe ?? getRememberMe()
    const body: Record<string, unknown> = {
      remember_me: rememberMe,
    }
    if (rememberMe && typeof options?.maxAgeSeconds === "number") {
      body.max_age_seconds = options.maxAgeSeconds
    }
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error("Failed to establish secure session. Check AUTH_SECRET.")
    }
  } else {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined)
  }
}

function getRememberMe(): boolean {
  if (!canUseStorage()) return false
  return readFromStores(REMEMBER_KEY) === "1"
}

function asPositiveSeconds(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function expiryFromTokens(tokens: TokenPair) {
  const now = Date.now()
  const accessExpiresAt =
    now + asPositiveSeconds(tokens.expires_in, 30 * 60) * 1000
  const refreshExpiresAt =
    now + asPositiveSeconds(tokens.refresh_expires_in, 24 * 60 * 60) * 1000
  return { accessExpiresAt, refreshExpiresAt }
}

/** Read exp claim from a JWT without verifying signature (client scheduling only). */
function jwtExpMs(token: string | null): number | null {
  if (!token) return null
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/")
    const pad =
      padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
    const json =
      typeof atob === "function"
        ? atob(padded + pad)
        : Buffer.from(padded + pad, "base64").toString("utf8")
    const data = JSON.parse(json) as { exp?: number }
    return typeof data.exp === "number" ? data.exp * 1000 : null
  } catch {
    return null
  }
}

function hasTokens() {
  return Boolean(readFromStores(ACCESS_KEY) || readFromStores(REFRESH_KEY))
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
    if (raw) {
      const value = Number(raw)
      if (Number.isFinite(value)) return value
    }
    return jwtExpMs(this.getAccessToken())
  },

  getRefreshExpiresAt(): number | null {
    const raw = readFromStores(REFRESH_EXP_KEY)
    if (raw) {
      const value = Number(raw)
      if (Number.isFinite(value)) return value
    }
    return jwtExpMs(this.getRefreshToken())
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
    return enqueueSession(async () => {
      if (!canUseStorage()) return
      const epoch = bumpEpoch()
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
          maxAgeSeconds: remember ? SESSION_REMEMBER_MAX_AGE_SECONDS : undefined,
        })
        if (currentEpoch() !== epoch) return
      } catch (err) {
        if (currentEpoch() === epoch) {
          removeKeys(ALL_KEYS)
          await syncServerSession(null)
        }
        throw err
      }
    })
  },

  async setTokens(tokens: TokenPair) {
    return enqueueSession(async () => {
      if (!canUseStorage()) return
      const epoch = bumpEpoch()
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
          maxAgeSeconds: remember ? SESSION_REMEMBER_MAX_AGE_SECONDS : undefined,
        })
        if (currentEpoch() !== epoch) return
      } catch (err) {
        if (currentEpoch() === epoch) {
          removeKeys(ALL_KEYS)
          await syncServerSession(null)
        }
        throw err
      }
    })
  },

  async setUser(user: User) {
    return enqueueSession(async () => {
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
    })
  },

  /**
   * Drop an orphan middleware cookie when local tokens are absent.
   * Re-checks inside the session lock so a concurrent login cannot be wiped.
   */
  async clearIfEmpty() {
    return enqueueSession(async () => {
      if (!canUseStorage()) return
      if (hasTokens()) return
      await syncServerSession(null)
    })
  },

  async clear() {
    return enqueueSession(async () => {
      if (!canUseStorage()) return
      bumpEpoch()
      removeKeys(ALL_KEYS)
      await syncServerSession(null)
    })
  },
}
