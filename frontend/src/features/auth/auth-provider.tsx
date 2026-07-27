"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"

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

const PUBLIC_PATHS = ["/login", "/register"]

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = authStorage.getAccessToken()
    if (!token) {
      setUser(null)
      return
    }

    try {
      const me = await authService.me()
      setUser(me)
      authStorage.setSession(me, {
        access_token: authStorage.getAccessToken() ?? "",
        refresh_token: authStorage.getRefreshToken() ?? "",
        token_type: "bearer",
      })
    } catch {
      authStorage.clear()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const cached = authStorage.getUser()
    if (cached) setUser(cached)

    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  useEffect(() => {
    if (loading) return

    const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))
    const isAuthenticated = Boolean(user && authStorage.getAccessToken())

    if (!isAuthenticated && !isPublic && pathname !== "/") {
      router.replace("/login")
    }

    if (isAuthenticated && isPublic) {
      router.replace("/dashboard")
    }
  }, [loading, pathname, router, user])

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await authService.login(payload)
    setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await authService.register(payload)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
    router.replace("/login")
  }, [router])

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
