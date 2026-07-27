export type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  request_id?: string
  detail?: string | Array<{ msg?: string }>
}

export type HealthResponse = {
  status: string
  app: string
  version: string
  environment: string
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}
