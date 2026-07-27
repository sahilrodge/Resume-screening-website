import { apiClient } from "@/lib/api"
import { sharedRefresh } from "@/lib/auth-refresh"
import { authStorage } from "@/lib/auth-storage"
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  TokenPair,
  User,
} from "@/types/auth"

export const authApi = {
  login(payload: LoginPayload) {
    return apiClient.post<AuthResponse>("/auth/login", payload, {
      skipAuth: true,
      skipAuthRefresh: true,
    })
  },

  register(payload: RegisterPayload) {
    return apiClient.post<AuthResponse>("/auth/register", payload, {
      skipAuth: true,
      skipAuthRefresh: true,
    })
  },

  me() {
    return apiClient.get<User>("/auth/me")
  },

  updateMe(payload: {
    full_name?: string
    current_password?: string
    new_password?: string
  }) {
    return apiClient.patch<User>("/auth/me", payload)
  },

  refresh(refreshToken: string, rememberMe?: boolean) {
    return apiClient.post<TokenPair>(
      "/auth/refresh",
      {
        refresh_token: refreshToken,
        remember_me: rememberMe,
      },
      { skipAuth: true, skipAuthRefresh: true }
    )
  },

  logout(refreshToken: string) {
    return apiClient.post(
      "/auth/logout",
      { refresh_token: refreshToken },
      { skipAuth: true, skipAuthRefresh: true }
    )
  },
}

/** Auth service — session helpers on top of authApi */
export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const data = await authApi.login(payload)
    await authStorage.setSession(data.user, data.tokens)
    return data
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const data = await authApi.register({
      ...payload,
      remember_me: payload.remember_me ?? false,
    })
    // Register issues session tokens; persist with remember_me from tokens
    await authStorage.setSession(data.user, {
      ...data.tokens,
      remember_me: payload.remember_me ?? data.tokens.remember_me,
    })
    return data
  },

  me(): Promise<User> {
    return authApi.me()
  },

  async updateMe(payload: {
    full_name?: string
    current_password?: string
    new_password?: string
  }): Promise<User> {
    const user = await authApi.updateMe(payload)
    await authStorage.setUser(user)
    return user
  },

  async refresh(): Promise<TokenPair> {
    const tokens = await sharedRefresh()
    if (!tokens) {
      throw new Error("Session expired")
    }
    return tokens
  },

  async logout(): Promise<void> {
    const refreshToken = authStorage.getRefreshToken()
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken)
      }
    } finally {
      await authStorage.clear()
    }
  },
}
