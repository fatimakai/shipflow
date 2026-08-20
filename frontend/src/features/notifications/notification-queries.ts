import { useInfiniteQuery, useQuery } from "@tanstack/react-query"

import { organizationKeys } from "@/features/organizations/organization-queries"

import { notificationApi } from "./notification-api"

export const notificationKeys = {
  feed: (organizationId: string, unreadOnly: boolean, limit: number) =>
    [
      ...organizationKeys.scope(organizationId),
      "notifications",
      "feed",
      { limit, unreadOnly },
    ] as const,
  preferences: ["notifications", "preferences"] as const,
  scope: (organizationId: string) =>
    [...organizationKeys.scope(organizationId), "notifications"] as const,
  unreadCount: (organizationId: string) =>
    [
      ...organizationKeys.scope(organizationId),
      "notifications",
      "unread-count",
    ] as const,
}

export function useNotificationFeed(
  organizationId: string | null,
  options: {
    enabled?: boolean
    isVisible?: boolean
    limit?: number
    poll?: boolean
    unreadOnly?: boolean
  } = {}
) {
  const enabled = options.enabled ?? true
  const limit = options.limit ?? 20
  const unreadOnly = options.unreadOnly ?? false

  return useInfiniteQuery({
    enabled: Boolean(organizationId) && enabled,
    queryKey: organizationId
      ? notificationKeys.feed(organizationId, unreadOnly, limit)
      : ["organization", "none", "notifications", "feed"],
    queryFn: ({ pageParam }) =>
      notificationApi.list({
        cursor: pageParam ?? undefined,
        limit,
        organizationId: organizationId!,
        unreadOnly,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval:
      options.poll && options.isVisible !== false ? 30_000 : false,
    refetchOnWindowFocus: true,
  })
}

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    enabled,
    queryKey: notificationKeys.preferences,
    queryFn: notificationApi.preferences,
  })
}

export function useNotificationUnreadCount(
  organizationId: string | null,
  options: { enabled?: boolean; isVisible?: boolean; poll?: boolean } = {}
) {
  const enabled = options.enabled ?? true

  return useQuery({
    enabled: Boolean(organizationId) && enabled,
    queryKey: organizationId
      ? notificationKeys.unreadCount(organizationId)
      : ["organization", "none", "notifications", "unread-count"],
    queryFn: () => notificationApi.unreadCount(organizationId!),
    refetchInterval:
      options.poll && options.isVisible !== false ? 30_000 : false,
    refetchOnWindowFocus: true,
  })
}
