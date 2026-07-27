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

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshTimer = useRef<number | null>(null)

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current != null) {
      window.clearTimeout(refreshTimer.current)
      refreshTimer.current = null
    }
  }, [])

  const forceLogout = useCallback(async () => {
    clearRefreshTimer()
    await authStorage.clear()
    setUser(null)
    if (!isPublicPath(pathname)) {
      router.replace("/login")
    }
  }, [clearRefreshTimer, pathname, router])

  const scheduleProactiveRefresh = useCallback(() => {
    clearRefreshTimer()
    if (typeof window === "undefined") return

    const accessExp = authStorage.getAccessExpiresAt()
    const refreshExp = authStorage.getRefreshExpiresAt()
    if (!refreshExp || Date.now() >= refreshExp) {
      void forceLogout()
      return
    }

    // Refresh 60s before access expiry (minimum wait 5s)
    const refreshAt = accessExp ? accessExp - 60_000 : Date.now() + 5_000
    const delay = Math.max(5_000, refreshAt - Date.now())

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

  const refreshUser = useCallback(async () => {
    if (authStorage.isRefreshExpired() && !authStorage.getAccessToken()) {
      await authStorage.clear()
      setUser(null)
      return
    }

    if (!authStorage.getAccessToken() && !authStorage.getRefreshToken()) {
      await authStorage.clear()
      setUser(null)
      return
    }

    try {
      if (authStorage.shouldRefreshAccess() && authStorage.getRefreshToken()) {
        await authService.refresh()
      }
      const me = await authService.me()
      setUser(me)
      await authStorage.setUser(me)
      scheduleProactiveRefresh()
    } catch {
      // One refresh attempt if access is stale
      try {
        if (authStorage.getRefreshToken() && !authStorage.isRefreshExpired()) {
          await authService.refresh()
          const me = await authService.me()
          setUser(me)
          await authStorage.setUser(me)
          scheduleProactiveRefresh()
          return
        }
      } catch {
        // fall through
      }
      await authStorage.clear()
      setUser(null)
      clearRefreshTimer()
    }
  }, [clearRefreshTimer, scheduleProactiveRefresh])

  useEffect(() => {
    const cached = authStorage.getUser()
    if (cached) setUser(cached)

    refreshUser().finally(() => setLoading(false))
    return () => clearRefreshTimer()
  }, [refreshUser, clearRefreshTimer])

  // Auto-logout when refresh lifetime elapses (tab left open)
  useEffect(() => {
    if (loading || !user) return
    const refreshExp = authStorage.getRefreshExpiresAt()
    if (!refreshExp) return
    const delay = Math.max(1_000, refreshExp - Date.now())
    const id = window.setTimeout(() => {
      void forceLogout()
    }, delay)
    return () => window.clearTimeout(id)
  }, [loading, user, forceLogout])

  // Resume silent refresh when the tab becomes visible again
  useEffect(() => {
    if (loading || !user) return
    function onVisible() {
      if (document.visibilityState !== "visible") return
      if (authStorage.isRefreshExpired()) {
        void forceLogout()
        return
      }
      if (authStorage.shouldRefreshAccess()) {
        void authService
          .refresh()
          .then(() => scheduleProactiveRefresh())
          .catch(() => forceLogout())
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [loading, user, forceLogout, scheduleProactiveRefresh])

  const logout = useCallback(async () => {
    clearRefreshTimer()
    await authService.logout()
    setUser(null)
    router.replace("/login")
  }, [router, clearRefreshTimer])

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
      scheduleProactiveRefresh()
      return data
    },
    [scheduleProactiveRefresh]
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data = await authService.register(payload)
      setUser(data.user)
      scheduleProactiveRefresh()
      return data
    },
    [scheduleProactiveRefresh]
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
