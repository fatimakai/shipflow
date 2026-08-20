import { isApiError } from "@/api/api-error"

export function getNotificationErrorMessage(
  error: unknown,
  fallback = "Notifications are temporarily unavailable. Please try again."
) {
  if (!isApiError(error)) return fallback

  if (error.statusCode === 0) {
    return "The notification service is unreachable. Check your connection and try again."
  }

  if (error.statusCode >= 500) return fallback
  return error.message || fallback
}
