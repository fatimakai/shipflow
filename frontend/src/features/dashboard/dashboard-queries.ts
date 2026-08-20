import { useBillingState } from "@/features/billing/billing-queries"
import { useFileUsage } from "@/features/files/file-queries"
import { useNotificationUnreadCount } from "@/features/notifications/notification-queries"

export function useDashboardBilling(
  organizationId: string | null,
  enabled: boolean
) {
  return useBillingState(organizationId, { enabled })
}

export function useDashboardFileUsage(
  organizationId: string | null,
  enabled: boolean
) {
  return useFileUsage(organizationId, { enabled })
}

export function useDashboardUnreadNotifications(
  organizationId: string | null,
  enabled: boolean
) {
  return useNotificationUnreadCount(organizationId, { enabled })
}
