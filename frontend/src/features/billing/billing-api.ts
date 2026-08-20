import { apiClient } from "@/api/api-client"
import type {
  BillingPlanListResponseDto,
  BillingStateResponseDto,
  CheckoutSessionResponseDto,
  CreateCheckoutSessionDto,
  PortalSessionResponseDto,
} from "@/api/generated"

function billingPath(organizationId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}/billing`
}

export const billingApi = {
  checkout: (organizationId: string, body: CreateCheckoutSessionDto) =>
    apiClient.post<CheckoutSessionResponseDto>(
      `${billingPath(organizationId)}/checkout-session`,
      { auth: true, json: body }
    ),
  plans: () => apiClient.get<BillingPlanListResponseDto>("/billing/plans"),
  portal: (organizationId: string) =>
    apiClient.post<PortalSessionResponseDto>(
      `${billingPath(organizationId)}/portal-session`,
      { auth: true }
    ),
  state: (organizationId: string) =>
    apiClient.get<BillingStateResponseDto>(billingPath(organizationId), {
      auth: true,
    }),
}
