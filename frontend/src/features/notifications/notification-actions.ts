import { useMutation, useQueryClient } from "@tanstack/react-query"

import { notificationApi } from "./notification-api"
import { notificationKeys } from "./notification-queries"

export function useNotificationActions(organizationId: string) {
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: notificationKeys.scope(organizationId),
    })

  const markRead = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: refresh,
  })
  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(organizationId),
    onSuccess: refresh,
  })

  return { markAllRead, markRead }
}
