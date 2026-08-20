import { apiClient } from "@/api/api-client"
import type {
  NotificationListResponseDto,
  NotificationMarkAllReadResponseDto,
  NotificationPreferenceResponseDto,
  NotificationResponseDto,
  NotificationUnreadCountResponseDto,
  UpdateNotificationPreferenceDto,
} from "@/api/generated"

interface ListNotificationsOptions {
  cursor?: string
  limit?: number
  organizationId: string
  unreadOnly?: boolean
}

export const notificationApi = {
  list: ({
    cursor,
    limit = 20,
    organizationId,
    unreadOnly = false,
  }: ListNotificationsOptions) => {
    const query = new URLSearchParams({
      limit: String(limit),
      organizationId,
      unreadOnly: String(unreadOnly),
    })
    if (cursor) query.set("cursor", cursor)

    return apiClient.get<NotificationListResponseDto>(
      `/notifications?${query.toString()}`,
      { auth: true }
    )
  },
  markAllRead: (organizationId: string) =>
    apiClient.post<NotificationMarkAllReadResponseDto>(
      "/notifications/mark-all-read",
      { auth: true, json: { organizationId } }
    ),
  markRead: (notificationId: string) =>
    apiClient.patch<NotificationResponseDto>(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
      { auth: true }
    ),
  preferences: () =>
    apiClient.get<NotificationPreferenceResponseDto>(
      "/notifications/preferences",
      { auth: true }
    ),
  unreadCount: (organizationId: string) =>
    apiClient.get<NotificationUnreadCountResponseDto>(
      `/notifications/unread-count?organizationId=${encodeURIComponent(organizationId)}`,
      { auth: true }
    ),
  updatePreferences: (body: UpdateNotificationPreferenceDto) =>
    apiClient.patch<NotificationPreferenceResponseDto>(
      "/notifications/preferences",
      { auth: true, json: body }
    ),
}
