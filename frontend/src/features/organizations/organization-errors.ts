import { isApiError } from "@/api/api-error"

export function getOrganizationErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
) {
  if (!isApiError(error)) {
    return fallback
  }

  if (error.statusCode === 0) {
    return "The service is unreachable. Check your connection and try again."
  }

  return error.message || fallback
}
