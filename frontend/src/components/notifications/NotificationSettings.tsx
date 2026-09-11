import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { NotificationPreferenceResponseDto } from "@/api/generated"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { notificationApi } from "@/features/notifications/notification-api"
import { getNotificationErrorMessage } from "@/features/notifications/notification-errors"
import {
  notificationKeys,
  useNotificationPreferences,
} from "@/features/notifications/notification-queries"

export function NotificationSettings({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const preferences = useNotificationPreferences()
  const [draft, setDraft] = useState<{
    source: boolean
    value: boolean
  } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedValue = preferences.data?.organizationEnabled ?? true
  const organizationEnabled =
    draft?.source === savedValue ? draft.value : savedValue
  const hasChanges = organizationEnabled !== savedValue
  const updatePreferences = useMutation({
    mutationFn: notificationApi.updatePreferences,
    onError: (failure) => setSaveError(getNotificationErrorMessage(failure)),
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationPreferenceResponseDto>(
        notificationKeys.preferences,
        updated
      )
      setDraft(null)
      setSaveError(null)
      toast.success("Notification preferences updated")
    },
  })

  if (preferences.isPending) {
    return (
      <Card className="w-full space-y-5 rounded-lg border-border p-6 shadow-sm">
        <Skeleton className="h-6 w-48" />
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-16 w-full" />
        ))}
      </Card>
    )
  }

  if (preferences.isError) {
    return (
      <Card className="flex w-full flex-col items-center rounded-lg border-border px-6 py-16 text-center shadow-sm">
        <AlertCircle className="mb-3 h-7 w-7 text-danger" />
        <h2 className="text-sm font-medium">Could not load preferences</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {getNotificationErrorMessage(preferences.error)}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void preferences.refetch()}
        >
          <RefreshCw />
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <Card className="w-full rounded-lg border-border p-6 shadow-sm">
      <div className="max-w-3xl">
        <h2 className="font-heading text-lg font-semibold">Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which account updates appear in ShipFlow.
        </p>

        <div className="mt-6 divide-y divide-border border-y border-border">
          <PreferenceRow
            id="organization-notifications"
            title="Organization updates"
            description="Invitations, role changes, removals, and ownership updates."
            checked={organizationEnabled}
            disabled={!canManage || updatePreferences.isPending}
            onCheckedChange={(value) => setDraft({ source: savedValue, value })}
          />
          <PreferenceRow
            id="security-notifications"
            title="Security alerts"
            description="Important password and account security activity."
            checked
            disabled
            required
          />
          <PreferenceRow
            id="billing-notifications"
            title="Billing alerts"
            description="Payment failures, refunds, disputes, and subscription changes."
            checked
            disabled
            required
          />
        </div>

        {saveError && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {saveError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          {hasChanges && (
            <span className="text-sm text-muted-foreground">
              Unsaved changes
            </span>
          )}
          <Button
            disabled={!canManage || !hasChanges || updatePreferences.isPending}
            onClick={() => updatePreferences.mutate({ organizationEnabled })}
          >
            {updatePreferences.isPending && (
              <LoaderCircle className="animate-spin" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </Card>
  )
}

function PreferenceRow({
  checked,
  description,
  disabled,
  id,
  onCheckedChange,
  required = false,
  title,
}: {
  checked: boolean
  description: string
  disabled: boolean
  id: string
  onCheckedChange?: (value: boolean) => void
  required?: boolean
  title: string
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <div className="flex items-center gap-2">
          <Label htmlFor={id}>{title}</Label>
          {required && <Badge variant="secondary">Required</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}
