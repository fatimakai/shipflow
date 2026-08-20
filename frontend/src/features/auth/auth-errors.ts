import { isApiError } from "@/api/api-error"

export function getAuthErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
) {
  if (!isApiError(error)) {
    return fallback
  }

  if (error.statusCode === 0) {
    return "The service is unreachable. Check your connection and try again."
  }

  if (error.statusCode === 429) {
    return "Too many attempts. Please wait a few minutes and try again."
  }

  return error.message || fallback
}
