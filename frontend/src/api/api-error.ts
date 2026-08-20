export interface ApiErrorDetails {
  error?: string
  messages?: string[]
  method?: string
  path?: string
  requestId?: string
  statusCode: number
}

export class ApiError extends Error {
  readonly error?: string
  readonly messages: string[]
  readonly method?: string
  readonly path?: string
  readonly requestId?: string
  readonly statusCode: number

  constructor(message: string, details: ApiErrorDetails) {
    super(message)
    this.name = "ApiError"
    this.error = details.error
    this.messages = details.messages ?? []
    this.method = details.method
    this.path = details.path
    this.requestId = details.requestId
    this.statusCode = details.statusCode
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
