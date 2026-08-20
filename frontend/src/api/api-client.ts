import { env } from "@/config/env"

import { ApiError } from "./api-error"

interface ApiAuthAdapter {
  clearSession: () => void
  getAccessToken: () => string | null
  refreshAccessToken?: () => Promise<string | null>
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean
  body?: BodyInit | null
  includeCredentials?: boolean
  json?: unknown
}

interface ApiErrorPayload {
  error?: unknown
  message?: unknown
  messages?: unknown
  method?: unknown
  path?: unknown
  requestId?: unknown
  statusCode?: unknown
}

let authAdapter: ApiAuthAdapter = {
  clearSession: () => undefined,
  getAccessToken: () => null,
}

let refreshPromise: Promise<string | null> | null = null

export function configureApiAuth(adapter: ApiAuthAdapter) {
  authAdapter = adapter
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return response.json()
  }

  const text = await response.text()
  return text || undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function asMessages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (message): message is string => typeof message === "string"
    )
  }

  return typeof value === "string" ? [value] : []
}

function createApiError(response: Response, payload: unknown) {
  const details =
    payload && typeof payload === "object" ? (payload as ApiErrorPayload) : {}
  const messages = asMessages(details.messages ?? details.message)
  const fallbackMessage = `Request failed with status ${response.status}`

  return new ApiError(
    messages[0] ?? asString(details.error) ?? fallbackMessage,
    {
      error: asString(details.error),
      messages,
      method: asString(details.method),
      path: asString(details.path),
      requestId:
        asString(details.requestId) ??
        response.headers.get("x-request-id") ??
        undefined,
      statusCode:
        typeof details.statusCode === "number"
          ? details.statusCode
          : response.status,
    }
  )
}

async function refreshAccessToken() {
  if (!authAdapter.refreshAccessToken) {
    return null
  }

  refreshPromise ??= authAdapter.refreshAccessToken().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
  hasRetried = false,
  accessTokenOverride?: string
): Promise<T> {
  const {
    auth = false,
    body,
    headers: suppliedHeaders,
    includeCredentials = false,
    json,
    ...requestInit
  } = options
  const headers = new Headers(suppliedHeaders)
  const accessToken = auth
    ? (accessTokenOverride ?? authAdapter.getAccessToken())
    : null

  if (json !== undefined && body !== undefined) {
    throw new Error("An API request cannot provide both body and json")
  }

  if (json !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`)
  }

  let response: Response

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...requestInit,
      body: json === undefined ? body : JSON.stringify(json),
      credentials: includeCredentials ? "include" : "same-origin",
      headers,
    })
  } catch (error) {
    throw new ApiError("Unable to reach the API", {
      messages: [
        error instanceof Error ? error.message : "Network request failed",
      ],
      statusCode: 0,
    })
  }

  if (response.status === 401 && auth && !hasRetried) {
    let refreshedToken: string | null

    try {
      refreshedToken = await refreshAccessToken()
    } catch (error) {
      authAdapter.clearSession()
      throw error
    }

    if (refreshedToken) {
      return request<T>(path, options, true, refreshedToken)
    }

    authAdapter.clearSession()
  }

  const payload = await parseResponseBody(response)

  if (!response.ok) {
    throw createApiError(response, payload)
  }

  return payload as T
}

export const apiClient = {
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  get: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  patch: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "PATCH" }),
  post: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "POST" }),
  put: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "PUT" }),
}
