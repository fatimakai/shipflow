import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CheckCheck, Settings, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import type { NotificationResponseDto } from "@/api/generated"
import { NotificationList } from "@/components/notifications/NotificationList"
import { NotificationSettings } from "@/components/notifications/NotificationSettings"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNotificationActions } from "@/features/notifications/notification-actions"
import { getNotificationErrorMessage } from "@/features/notifications/notification-errors"
import { getSafeNotificationPath } from "@/features/notifications/notification-links"
import {
  useNotificationFeed,
  useNotificationUnreadCount,
} from "@/features/notifications/notification-queries"
import { useDocumentVisibility } from "@/hooks/use-document-visibility"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"
import { useActiveOrganization } from "@/features/organizations/organization-queries"
import { recoverOrganizationAuthorization } from "@/features/organizations/organization-session"

export function Notifications() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const organization = useActiveOrganization()
  const isVisible = useDocumentVisibility()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const organizationId = organization?.id ?? null
  const canManageNotifications = hasOrganizationCapability(
    organization,
    "notification:manage"
  )
  const isSettings = location.pathname.endsWith("/settings")
  const feed = useNotificationFeed(organizationId, {
    isVisible,
    poll: !isSettings,
    unreadOnly,
  })
  const unreadCount = useNotificationUnreadCount(organizationId, {
    isVisible,
    poll: !isSettings,
  })
  const actions = useNotificationActions(organizationId ?? "")
  const notifications = feed.data?.pages.flatMap((page) => page.items) ?? []

  useEffect(() => {
    if (!feed.error || !organizationId) return
    void recoverOrganizationAuthorization(
      feed.error,
      organizationId,
      queryClient
    )
  }, [feed.error, organizationId, queryClient])

  const handleFailure = async (failure: unknown) => {
    const recovered = organizationId
      ? await recoverOrganizationAuthorization(
          failure,
          organizationId,
          queryClient
        )
      : false
    if (!recovered) setErrorBanner(getNotificationErrorMessage(failure))
  }

  const handleMarkRead = async (notificationId: string) => {
    try {
      await actions.markRead.mutateAsync(notificationId)
    } catch (failure) {
      await handleFailure(failure)
    }
  }

  const handleOpen = async (notification: NotificationResponseDto) => {
    const destination = getSafeNotificationPath(
      notification.actionPath,
      organization
    )

    if (!notification.readAt && canManageNotifications) {
      try {
        await actions.markRead.mutateAsync(notification.id)
      } catch (failure) {
        await handleFailure(failure)
        return
      }
    }

    if (notification.actionPath && !destination) {
      setErrorBanner("This notification's destination is no longer available.")
      return
    }
    if (destination) navigate(destination)
  }

  return (
    <div className="space-y-6">
      {errorBanner && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger/10 p-3.5 text-sm text-danger"
          role="alert"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setErrorBanner(null)}
            aria-label="Dismiss notification error"
          >
            <X />
          </Button>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-heading text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Updates for {organization?.name ?? "your workspace"}.
          </p>
        </div>

        {!isSettings && canManageNotifications && (
          <div className="flex items-center gap-2">
            {(unreadCount.data?.count ?? 0) > 0 && (
              <Button
                variant="outline"
                disabled={actions.markAllRead.isPending}
                onClick={() =>
                  void actions.markAllRead.mutateAsync().catch(handleFailure)
                }
              >
                <CheckCheck />
                Mark all as read
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/notifications/settings")}
              aria-label="Notification settings"
              title="Notification settings"
            >
              <Settings />
            </Button>
          </div>
        )}
      </div>

      <Tabs
        value={isSettings ? "settings" : "all"}
        onValueChange={(value) =>
          navigate(
            value === "settings" ? "/notifications/settings" : "/notifications"
          )
        }
      >
        <div className="border-b border-border">
          <TabsList className="h-auto space-x-5 bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="rounded-none border-b-2 border-transparent px-2 py-2.5 font-medium shadow-none transition-none data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              All
            </TabsTrigger>
            {canManageNotifications && (
              <TabsTrigger
                value="settings"
                className="rounded-none border-b-2 border-transparent px-2 py-2.5 font-medium shadow-none transition-none data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Settings
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="mt-6">
          {isSettings ? (
            <NotificationSettings canManage={canManageNotifications} />
          ) : (
            <NotificationList
              canManage={canManageNotifications}
              errorMessage={
                feed.error ? getNotificationErrorMessage(feed.error) : undefined
              }
              hasNextPage={Boolean(feed.hasNextPage)}
              isError={feed.isError}
              isFetchingNextPage={feed.isFetchingNextPage}
              isLoading={feed.isPending}
              markingId={actions.markRead.variables}
              notifications={notifications}
              onFilterChange={setUnreadOnly}
              onLoadMore={() => void feed.fetchNextPage()}
              onMarkRead={(notificationId) =>
                void handleMarkRead(notificationId)
              }
              onOpen={(notification) => void handleOpen(notification)}
              onRetry={() => {
                void feed.refetch()
                void unreadCount.refetch()
              }}
              unreadOnly={unreadOnly}
            />
          )}
        </div>
      </Tabs>
    </div>
  )
}
