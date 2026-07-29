"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  canAccessPath,
  homeForRole,
  IDLE_TIMEOUT_MS,
  isPublicPath,
} from "@/lib/auth-roles"
import { authStorage } from "@/lib/auth-storage"
import { authService } from "@/services/auth"
import type { AuthResponse, LoginPayload, RegisterPayload, User } from "@/types/auth"

type AuthContextValue = {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<AuthResponse>
  register: (payload: RegisterPayload) => Promise<AuthResponse>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Browsers store setTimeout delays as signed 32-bit ints (max ~24.8 days).
 * A 30-day remember-me refresh TTL overflows and fires almost immediately.
 */
const MAX_TIMEOUT_MS = 2_147_483_647
const ACTIVITY_KEY = "hirepulse_last_activity_at"

function scheduleAt(expiresAt: number, onExpire: () => void): () => void {
  let timeoutId: number | null = null
  let cancelled = false

  const arm = () => {
    if (cancelled) return
    const remaining = expiresAt - Date.now()
    if (remaining <= 0) {
      onExpire()
      return
    }
    timeoutId = window.setTimeout(arm, Math.min(remaining, MAX_TIMEOUT_MS))
  }
  arm()

  return () => {
    cancelled = true
    if (timeoutId != null) window.clearTimeout(timeoutId)
  }
}

function touchActivity() {
  if (typeof window === "undefined") return
  try {
    const last = Number(window.localStorage.getItem(ACTIVITY_KEY) || 0)
    const now = Date.now()
    // Throttle writes — activity listeners fire frequently.
    if (Number.isFinite(last) && now - last < 15_000) return
    window.localStorage.setItem(ACTIVITY_KEY, String(now))
  } catch {
    // ignore quota / private mode
  }
}

function readLastActivity(): number {
  if (typeof window === "undefined") return Date.now()
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY)
    const value = raw ? Number(raw) : NaN
    return Number.isFinite(value) ? value : Date.now()
  } catch {
    return Date.now()
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshTimer = useRef<number | null>(null)
  const idleTimer = useRef<number | null>(null)
  const bootId = useRef(0)
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current != null) {
      window.clearTimeout(refreshTimer.current)
      refreshTimer.current = null
    }
  }, [])

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current != null) {
      window.clearTimeout(idleTimer.current)
      idleTimer.current = null
    }
  }, [])

  const forceLogout = useCallback(async () => {
    clearRefreshTimer()
    clearIdleTimer()
    await authStorage.clear()
    setUser(null)
    try {
      window.localStorage.removeItem(ACTIVITY_KEY)
    } catch {
      // ignore
    }
    window.location.replace("/login")
  }, [clearRefreshTimer, clearIdleTimer])

  const scheduleProactiveRefresh = useCallback(() => {
    clearRefreshTimer()
    if (typeof window === "undefined") return

    const refreshToken = authStorage.getRefreshToken()
    const refreshExp = authStorage.getRefreshExpiresAt()
    if (!refreshToken) {
      return
    }
    if (refreshExp && Date.now() >= refreshExp) {
      void forceLogout()
      return
    }

    const accessExp = authStorage.getAccessExpiresAt()
    const refreshAt = accessExp ? accessExp - 60_000 : Date.now() + 5_000
    const delay = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(5_000, refreshAt - Date.now())
    )

    refreshTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          if (authStorage.isRefreshExpired()) {
            await forceLogout()
            return
          }
          await authService.refresh()
          scheduleProactiveRefresh()
        } catch {
          await forceLogout()
        }
      })()
    }, delay)
  }, [clearRefreshTimer, forceLogout])

  const armIdleTimeout = useCallback(() => {
    clearIdleTimer()
    if (typeof window === "undefined" || IDLE_TIMEOUT_MS <= 0) return
    const last = readLastActivity()
    const remaining = Math.max(1_000, IDLE_TIMEOUT_MS - (Date.now() - last))
    idleTimer.current = window.setTimeout(() => {
      if (Date.now() - readLastActivity() >= IDLE_TIMEOUT_MS) {
        void forceLogout()
      } else {
        armIdleTimeout()
      }
    }, Math.min(remaining, MAX_TIMEOUT_MS))
  }, [clearIdleTimer, forceLogout])

  const refreshUser = useCallback(async () => {
    const access = authStorage.getAccessToken()
    const refresh = authStorage.getRefreshToken()

    if (!access && !refresh) {
      setUser(null)
      // Drop orphan cookie only; re-checks inside the lock so login cannot be wiped.
      await authStorage.clearIfEmpty()
      return
    }

    if (authStorage.isRefreshExpired() && !access) {
      await authStorage.clear()
      setUser(null)
      return
    }

    try {
      if (authStorage.shouldRefreshAccess() && refresh) {
        await authService.refresh()
      }
      const me = await authService.me()
      setUser(me)
      await authStorage.setUser(me)
      touchActivity()
      scheduleProactiveRefresh()
      armIdleTimeout()
    } catch {
      try {
        if (authStorage.getRefreshToken() && !authStorage.isRefreshExpired()) {
          await authService.refresh()
          const me = await authService.me()
          setUser(me)
          await authStorage.setUser(me)
          touchActivity()
          scheduleProactiveRefresh()
          armIdleTimeout()
          return
        }
      } catch {
        // fall through
      }
      await authStorage.clear()
      setUser(null)
      clearRefreshTimer()
      clearIdleTimer()
    }
  }, [
    clearRefreshTimer,
    clearIdleTimer,
    scheduleProactiveRefresh,
    armIdleTimeout,
  ])

  useEffect(() => {
    const id = ++bootId.current
    const cached = authStorage.getUser()
    if (cached) setUser(cached)

    void refreshUser().finally(() => {
      if (bootId.current === id) setLoading(false)
    })
    return () => {
      clearRefreshTimer()
      clearIdleTimer()
    }
    // Bootstrap once on mount; refreshUser is stable enough via queue + refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loading || !user) return
    const refreshExp = authStorage.getRefreshExpiresAt()
    if (!refreshExp) return
    return scheduleAt(refreshExp, () => {
      if (authStorage.isRefreshExpired()) {
        void forceLogout()
      }
    })
  }, [loading, user, forceLogout])

  useEffect(() => {
    if (loading || !user) return
    function onVisible() {
      if (document.visibilityState !== "visible") return
      if (authStorage.isRefreshExpired()) {
        void forceLogout()
        return
      }
      if (Date.now() - readLastActivity() >= IDLE_TIMEOUT_MS) {
        void forceLogout()
        return
      }
      touchActivity()
      armIdleTimeout()
      if (authStorage.shouldRefreshAccess()) {
        void authService
          .refresh()
          .then(() => scheduleProactiveRefresh())
          .catch(() => forceLogout())
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [loading, user, forceLogout, scheduleProactiveRefresh, armIdleTimeout])

  useEffect(() => {
    if (loading || !user) return

    const onActivity = () => {
      touchActivity()
      armIdleTimeout()
    }

    const events: Array<keyof DocumentEventMap> = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ]
    events.forEach((event) =>
      document.addEventListener(event, onActivity, { passive: true })
    )
    touchActivity()
    armIdleTimeout()

    return () => {
      events.forEach((event) => document.removeEventListener(event, onActivity))
      clearIdleTimer()
    }
  }, [loading, user, armIdleTimeout, clearIdleTimer])

  const logout = useCallback(async () => {
    clearRefreshTimer()
    clearIdleTimer()
    try {
      await authService.logout()
    } finally {
      setUser(null)
      try {
        window.localStorage.removeItem(ACTIVITY_KEY)
      } catch {
        // ignore
      }
      // Hard redirect clears SPA history + avoids bfcache of protected pages
      window.location.replace("/login")
    }
  }, [clearRefreshTimer, clearIdleTimer])

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      const hasSession = Boolean(
        authStorage.getAccessToken() || authStorage.getRefreshToken()
      )
      if (!hasSession && !isPublicPath(window.location.pathname)) {
        window.location.replace("/login")
      }
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  useEffect(() => {
    if (loading) return

    const isPublic = isPublicPath(pathname)
    const isAuthenticated = Boolean(
      user && (authStorage.getAccessToken() || authStorage.getRefreshToken())
    )

    if (!isAuthenticated && !isPublic && pathname !== "/") {
      router.replace("/login")
      return
    }

    if (isAuthenticated && user) {
      if (isPublic || pathname === "/") {
        router.replace(homeForRole(user.role))
        return
      }
      if (!canAccessPath(user.role, pathname)) {
        router.replace(homeForRole(user.role))
      }
    }
  }, [loading, pathname, router, user])

  const login = useCallback(
    async (payload: LoginPayload) => {
      const data = await authService.login(payload)
      setUser(data.user)
      touchActivity()
      scheduleProactiveRefresh()
      armIdleTimeout()
      return data
    },
    [scheduleProactiveRefresh, armIdleTimeout]
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data = await authService.register(payload)
      setUser(data.user)
      touchActivity()
      scheduleProactiveRefresh()
      armIdleTimeout()
      return data
    },
    [scheduleProactiveRefresh, armIdleTimeout]
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, logout, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
