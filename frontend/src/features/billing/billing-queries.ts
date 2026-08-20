import { useQuery } from "@tanstack/react-query"

import { organizationKeys } from "@/features/organizations/organization-queries"

import { billingApi } from "./billing-api"

export const billingKeys = {
  plans: ["billing", "plans"] as const,
  state: (organizationId: string) =>
    [...organizationKeys.scope(organizationId), "billing", "state"] as const,
}

export function useBillingPlans() {
  return useQuery({
    queryKey: billingKeys.plans,
    queryFn: billingApi.plans,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBillingState(
  organizationId: string | null,
  options: { enabled?: boolean; poll?: boolean } = {}
) {
  const enabled = options.enabled ?? true

  return useQuery({
    enabled: Boolean(organizationId) && enabled,
    queryKey: organizationId
      ? billingKeys.state(organizationId)
      : ["organization", "none", "billing", "state"],
    queryFn: () => billingApi.state(organizationId!),
    refetchInterval: options.poll
      ? (query) => (query.state.data?.hasPaidAccess === true ? false : 2_000)
      : false,
    refetchOnWindowFocus: true,
  })
}
