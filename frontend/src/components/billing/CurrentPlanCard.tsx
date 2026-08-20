import type { BillingStateResponseDto } from "@/api/generated"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ExternalLink, LoaderCircle } from "lucide-react"

type SubscriptionStatus = NonNullable<
  BillingStateResponseDto["subscriptionStatus"]
>

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  CANCELED: "Canceled",
  INCOMPLETE: "Incomplete",
  INCOMPLETE_EXPIRED: "Expired",
  PAST_DUE: "Past due",
  PAUSED: "Paused",
  TRIALING: "Trial",
  UNPAID: "Unpaid",
}

const STATUS_CLASSES: Record<SubscriptionStatus, string> = {
  ACTIVE: "border-success/20 bg-success/10 text-success",
  CANCELED: "border-border bg-secondary text-muted-foreground",
  INCOMPLETE: "border-warning/20 bg-warning/10 text-warning",
  INCOMPLETE_EXPIRED: "border-border bg-secondary text-muted-foreground",
  PAST_DUE: "border-danger/20 bg-danger/10 text-danger",
  PAUSED: "border-warning/20 bg-warning/10 text-warning",
  TRIALING: "border-primary/20 bg-primary/10 text-primary",
  UNPAID: "border-danger/20 bg-danger/10 text-danger",
}

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(cents / 100)
}

function getLifecycleMessage(state: BillingStateResponseDto) {
  const periodEnd = formatDate(state.currentPeriodEnd)
  const trialEnd = formatDate(state.trialEnd)
  const graceEnd = formatDate(state.gracePeriodEndsAt)

  if (!state.subscriptionStatus) {
    return "No paid subscription is attached to this workspace."
  }

  switch (state.subscriptionStatus) {
    case "TRIALING":
      return trialEnd
        ? `Trial access ends on ${trialEnd}.`
        : "Trial access is active."
    case "ACTIVE":
      if (state.cancelAtPeriodEnd) {
        return periodEnd
          ? `Access continues until cancellation on ${periodEnd}.`
          : "Cancellation is scheduled for the end of the billing period."
      }
      return periodEnd
        ? `The next billing period starts on ${periodEnd}.`
        : "Paid access is active."
    case "PAST_DUE":
      return graceEnd
        ? `Payment is overdue. Access remains available until ${graceEnd}.`
        : "Payment is overdue and paid access is currently unavailable."
    case "INCOMPLETE":
      return "Payment setup is incomplete. Finish it in the billing portal."
    case "CANCELED":
      return "The previous subscription has ended. You can start a new one."
    case "INCOMPLETE_EXPIRED":
      return "The previous payment setup expired before completion."
    case "UNPAID":
      return "The subscription is unpaid and paid access is unavailable."
    case "PAUSED":
      return "The subscription is paused and paid access is unavailable."
  }
}

interface CurrentPlanCardProps {
  canManage: boolean
  isManagePending: boolean
  onManage: () => void
  state: BillingStateResponseDto
}

export function CurrentPlanCard({
  canManage,
  isManagePending,
  onManage,
  state,
}: CurrentPlanCardProps) {
  const priceCents =
    state.interval === "ANNUAL"
      ? state.plan.annualPriceCents
      : state.plan.monthlyPriceCents
  const period = state.interval === "ANNUAL" ? "year" : "month"
  const status = state.subscriptionStatus

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>Backend-confirmed workspace access</CardDescription>
        </div>
        <CardAction>
          <Badge
            variant="outline"
            className={
              status
                ? STATUS_CLASSES[status]
                : "border-border bg-secondary text-muted-foreground"
            }
          >
            {status ? STATUS_LABELS[status] : "Free"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-3">
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {state.plan.name}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {state.plan.description}
              </p>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-2xl font-semibold text-foreground">
                {formatMoney(priceCents, state.plan.currency)}
              </span>
              <span className="text-sm text-muted-foreground">/{period}</span>
            </div>
            <p
              className={
                status === "PAST_DUE" || status === "UNPAID"
                  ? "text-sm text-danger"
                  : "text-sm text-muted-foreground"
              }
            >
              {getLifecycleMessage(state)}
            </p>
          </div>

          {status && canManage && (
            <Button
              variant="outline"
              onClick={onManage}
              disabled={isManagePending}
            >
              {isManagePending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ExternalLink />
              )}
              Manage billing
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
