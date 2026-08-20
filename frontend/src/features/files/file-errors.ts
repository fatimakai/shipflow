import { isApiError } from "@/api/api-error"

export function getFileErrorMessage(
  error: unknown,
  fallback = "Files are temporarily unavailable. Please try again."
) {
  if (!isApiError(error)) {
    return error instanceof Error && error.message ? error.message : fallback
  }

  if (error.statusCode === 0) {
    return "The file service is unreachable. Check your connection and try again."
  }
  if (error.statusCode >= 500) return fallback
  return error.message || fallback
}
