import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Bell,
  CheckCheck,
  RefreshCw,
  Settings,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { OrganizationResponseDto } from "@/api/generated"
import { recoverOrganizationAuthorization } from "@/features/organizations/organization-session"

import { useNotificationActions } from "../notification-actions"
import { getNotificationErrorMessage } from "../notification-errors"
import { NotificationCategoryIcon } from "../notification-format"
import { getSafeNotificationPath } from "../notification-links"
import {
  useNotificationFeed,
  useNotificationUnreadCount,
} from "../notification-queries"
import { useDocumentVisibility } from "@/hooks/use-document-visibility"
import { formatNotificationTime } from "../notification-time"

interface NotificationMenuProps {
  canManage: boolean
  organization: OrganizationResponseDto
}

export function NotificationMenu({
  canManage,
  organization,
}: NotificationMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isVisible = useDocumentVisibility()
  const [open, setOpen] = useState(false)
  const count = useNotificationUnreadCount(organization.id, {
    isVisible,
    poll: true,
  })
  const preview = useNotificationFeed(organization.id, {
    enabled: open,
    isVisible,
    limit: 5,
    poll: open,
  })
  const { markAllRead, markRead } = useNotificationActions(organization.id)
  const notifications = preview.data?.pages.flatMap((page) => page.items) ?? []
  const error = preview.error ?? count.error

  const recover = (failure: unknown) => {
    void recoverOrganizationAuthorization(failure, organization.id, queryClient)
  }
  const openNotification = async (
    notificationId: string,
    actionPath?: string | null
  ) => {
    const destination = getSafeNotificationPath(actionPath, organization)
    try {
      if (canManage) await markRead.mutateAsync(notificationId)
      setOpen(false)
      navigate(destination ?? "/notifications")
    } catch (failure) {
      recover(failure)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={
          count.data?.count
            ? `Notifications, ${count.data.count} unread`
            : "Notifications"
        }
        className="relative cursor-pointer rounded-md p-2 text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {(count.data?.count ?? 0) > 0 && (
          <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
            {count.data!.count > 99 ? "99+" : count.data!.count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-heading text-sm font-semibold">
              Notifications
            </h2>
            <p className="text-xs text-muted-foreground">
              {count.data?.count ?? 0} unread in {organization.name}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {canManage && (count.data?.count ?? 0) > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void markAllRead.mutateAsync().catch(recover)}
                disabled={markAllRead.isPending}
                aria-label="Mark all notifications as read"
                title="Mark all as read"
              >
                <CheckCheck />
              </Button>
            )}
            {canManage && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setOpen(false)
                  navigate("/notifications/settings")
                }}
                aria-label="Notification settings"
                title="Notification settings"
              >
                <Settings />
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {preview.isPending ? (
            <div className="space-y-3 p-4" aria-label="Loading notifications">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-md bg-muted/60"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <AlertCircle className="mb-2 h-5 w-5 text-danger" />
              <p className="text-sm text-muted-foreground">
                {getNotificationErrorMessage(error)}
              </p>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                onClick={() => {
                  void count.refetch()
                  void preview.refetch()
                }}
              >
                <RefreshCw />
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <Bell className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Workspace updates will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/60 ${notification.readAt ? "" : "bg-secondary/40"}`}
                onClick={() =>
                  void openNotification(
                    notification.id,
                    notification.actionPath
                  )
                }
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <NotificationCategoryIcon category={notification.category} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm ${notification.readAt ? "text-muted-foreground" : "font-medium text-foreground"}`}
                  >
                    {notification.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {notification.message}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatNotificationTime(notification.createdAt)}
                  </span>
                </span>
                {!notification.readAt && (
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                    aria-label="Unread"
                  />
                )}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setOpen(false)
              navigate("/notifications")
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
