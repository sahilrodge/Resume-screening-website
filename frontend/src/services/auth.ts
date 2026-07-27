import { apiClient } from "@/lib/api"
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

  refresh(refreshToken: string) {
    return apiClient.post<TokenPair>(
      "/auth/refresh",
      { refresh_token: refreshToken },
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
    authStorage.setSession(data.user, data.tokens)
    return data
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const data = await authApi.register(payload)
    authStorage.setSession(data.user, data.tokens)
    return data
  },

  me(): Promise<User> {
    return authApi.me()
  },

  async refresh(): Promise<TokenPair> {
    const refreshToken = authStorage.getRefreshToken()
    if (!refreshToken) {
      throw new Error("No refresh token")
    }
    const tokens = await authApi.refresh(refreshToken)
    authStorage.setTokens(tokens)
    return tokens
  },

  async logout(): Promise<void> {
    const refreshToken = authStorage.getRefreshToken()
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken)
      }
    } finally {
      authStorage.clear()
    }
  },
}
