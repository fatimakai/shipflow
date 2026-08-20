import { QueryClient } from "@tanstack/react-query"

import { isApiError } from "./api-error"

function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 1) {
    return false
  }

  return !isApiError(error) || error.statusCode === 0 || error.statusCode >= 500
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        staleTime: 30_000,
      },
    },
  })
}

export const queryClient = createQueryClient()
