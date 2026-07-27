import axios from "axios"

import { ApiError, type ApiErrorBody } from "@/types/api"

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0
    const data = error.response?.data as ApiErrorBody | undefined

    let message = error.message || "Request failed"
    if (data?.error?.message) message = data.error.message
    else if (typeof data?.detail === "string") message = data.detail
    else if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      message = data.detail[0].msg
    } else if (!error.response) {
      message = "Unable to reach the server. Check your connection."
    }

    return new ApiError(
      message,
      status,
      data?.error?.code,
      data?.error?.details ?? data?.detail
    )
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 0)
  }

  return new ApiError("Unexpected error", 0)
}
