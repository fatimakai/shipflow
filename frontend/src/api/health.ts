import { useQuery } from "@tanstack/react-query"

import type { ReadinessResponseDto } from "./generated"
import { apiClient } from "./api-client"

export const healthQueryKey = ["health", "ready"] as const

export function getApiReadiness() {
  return apiClient.get<ReadinessResponseDto>("/health/ready")
}

export function useApiReadiness() {
  return useQuery({
    queryFn: getApiReadiness,
    queryKey: healthQueryKey,
    refetchInterval: 30_000,
  })
}
