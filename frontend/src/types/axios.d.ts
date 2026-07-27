import "axios"

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Skip attaching Authorization header */
    skipAuth?: boolean
    /** Skip global API loading counter */
    skipLoading?: boolean
    /** Skip 401 → refresh-token retry */
    skipAuthRefresh?: boolean
    /** Internal flag set by interceptor after one retry */
    _retry?: boolean
  }
}
