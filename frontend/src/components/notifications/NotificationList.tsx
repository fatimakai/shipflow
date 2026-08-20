import { AlertCircle, Bell, CheckCheck, RefreshCw } from "lucide-react"

import type { NotificationResponseDto } from "@/api/generated"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { NotificationCategoryIcon } from "@/features/notifications/notification-format"
import { formatNotificationTime } from "@/features/notifications/notification-time"

interface NotificationListProps {
  canManage: boolean
  errorMessage?: string
  hasNextPage: boolean
  isError: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
  markingId?: string
  notifications: NotificationResponseDto[]
  onFilterChange: (unreadOnly: boolean) => void
  onLoadMore: () => void
  onMarkRead: (notificationId: string) => void
  onOpen: (notification: NotificationResponseDto) => void
  onRetry: () => void
  unreadOnly: boolean
}

export function NotificationList({
  canManage,
  errorMessage,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoading,
  markingId,
  notifications,
  onFilterChange,
  onLoadMore,
  onMarkRead,
  onOpen,
  onRetry,
  unreadOnly,
}: NotificationListProps) {
  return (
    <Card className="w-full rounded-lg border-border shadow-sm">
      <CardHeader className="flex flex-row items-center border-b border-border px-5 py-3">
        <div
          className="inline-flex rounded-md bg-secondary p-1"
          aria-label="Notification filter"
        >
          <Button
            variant={unreadOnly ? "ghost" : "outline"}
            size="sm"
            className="shadow-none"
            onClick={() => onFilterChange(false)}
          >
            All
          </Button>
          <Button
            variant={unreadOnly ? "outline" : "ghost"}
            size="sm"
            className="shadow-none"
            onClick={() => onFilterChange(true)}
          >
            Unread
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div aria-label="Loading notifications">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-0"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <AlertCircle className="mb-3 h-7 w-7 text-danger" />
            <h2 className="text-sm font-medium">
              Could not load notifications
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {errorMessage}
            </p>
            <Button className="mt-4" variant="outline" onClick={onRetry}>
              <RefreshCw />
              Retry
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Bell className="h-7 w-7 text-muted-foreground" />
            </span>
            <h2 className="font-heading text-base font-semibold">
              {unreadOnly ? "You're all caught up" : "No notifications yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {unreadOnly
                ? "There are no unread workspace updates."
                : "Workspace and account updates will appear here."}
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 border-b border-border px-5 py-4 last:border-0 ${notification.readAt ? "" : "bg-secondary/35"}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <NotificationCategoryIcon category={notification.category} />
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onOpen(notification)}
                >
                  <span
                    className={`block text-sm ${notification.readAt ? "text-muted-foreground" : "font-medium text-foreground"}`}
                  >
                    {notification.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {notification.message}
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {formatNotificationTime(notification.createdAt)}
                  </span>
                </button>
                {!notification.readAt && canManage && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={markingId === notification.id}
                    onClick={() => onMarkRead(notification.id)}
                    aria-label={`Mark ${notification.title} as read`}
                    title="Mark as read"
                  >
                    <CheckCheck />
                  </Button>
                )}
              </div>
            ))}
            {hasNextPage && (
              <div className="flex justify-center border-t border-border p-4">
                <Button
                  variant="outline"
                  disabled={isFetchingNextPage}
                  onClick={onLoadMore}
                >
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
