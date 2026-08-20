import { isApiError } from "@/api/api-error"

export function getBillingErrorMessage(
  error: unknown,
  fallback = "Billing is temporarily unavailable. Please try again."
) {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : fallback
  }

  if (error.statusCode === 0) {
    return "The billing service is unreachable. Check your connection and try again."
  }

  if (error.statusCode >= 500) return fallback

  return error.message || fallback
}
