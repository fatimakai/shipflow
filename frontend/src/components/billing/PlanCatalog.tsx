import type {
  BillingPlanResponseDto,
  BillingStateResponseDto,
  CreateCheckoutSessionDto,
} from "@/api/generated"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, ExternalLink, LoaderCircle } from "lucide-react"

type BillingInterval = CreateCheckoutSessionDto["interval"]

const PORTAL_REQUIRED_STATUSES = new Set([
  "ACTIVE",
  "INCOMPLETE",
  "PAST_DUE",
  "TRIALING",
])

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(cents / 100)
}

interface PlanCatalogProps {
  canManage: boolean
  checkoutPending: boolean
  interval: BillingInterval
  onCheckout: (interval: BillingInterval) => void
  onIntervalChange: (interval: BillingInterval) => void
  onManage: () => void
  plans: BillingPlanResponseDto[]
  portalPending: boolean
  state: BillingStateResponseDto
}

export function PlanCatalog({
  canManage,
  checkoutPending,
  interval,
  onCheckout,
  onIntervalChange,
  onManage,
  plans,
  portalPending,
  state,
}: PlanCatalogProps) {
  const portalRequired = Boolean(
    state.subscriptionStatus &&
    PORTAL_REQUIRED_STATUSES.has(state.subscriptionStatus)
  )

  return (
    <section className="space-y-4" aria-labelledby="available-plans-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="available-plans-title"
            className="font-heading text-lg font-semibold text-foreground"
          >
            Available plans
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pricing and features are loaded from the billing catalog.
          </p>
        </div>
        <div
          className="inline-flex w-fit rounded-lg border border-border bg-background p-1"
          role="group"
          aria-label="Billing interval"
        >
          {(["MONTHLY", "ANNUAL"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={interval === value ? "secondary" : "ghost"}
              onClick={() => onIntervalChange(value)}
              aria-pressed={interval === value}
            >
              {value === "MONTHLY" ? "Monthly" : "Annual"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = state.plan.code === plan.code
          const priceCents =
            interval === "ANNUAL"
              ? plan.annualPriceCents
              : plan.monthlyPriceCents
          const annualSavings = Math.max(
            0,
            plan.monthlyPriceCents * 12 - plan.annualPriceCents
          )
          const actionPending = checkoutPending || portalPending

          return (
            <Card
              key={plan.code}
              className={isCurrent ? "ring-primary/40" : ""}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && (
                    <Badge variant="outline" className="text-primary">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-5">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-heading text-2xl font-semibold text-foreground">
                      {formatMoney(priceCents, plan.currency)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      /{interval === "ANNUAL" ? "year" : "month"}
                    </span>
                  </div>
                  {interval === "ANNUAL" && annualSavings > 0 && (
                    <p className="mt-1 text-xs text-success">
                      Save {formatMoney(annualSavings, plan.currency)} each year
                    </p>
                  )}
                </div>

                <ul className="flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.code === "FREE" ? (
                  <Button variant="outline" disabled>
                    {isCurrent ? "Current plan" : "Managed in billing portal"}
                  </Button>
                ) : isCurrent && state.hasPaidAccess ? (
                  <Button variant="outline" disabled>
                    Current plan
                  </Button>
                ) : portalRequired ? (
                  <Button
                    onClick={onManage}
                    disabled={!canManage || actionPending}
                  >
                    {portalPending ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <ExternalLink />
                    )}
                    Resolve in billing portal
                  </Button>
                ) : (
                  <Button
                    onClick={() => onCheckout(interval)}
                    disabled={!canManage || actionPending}
                  >
                    {checkoutPending && (
                      <LoaderCircle className="animate-spin" />
                    )}
                    Choose {plan.name}
                  </Button>
                )}

                {!canManage && plan.code === "PRO" && !isCurrent && (
                  <p className="text-xs text-muted-foreground">
                    Billing-management permission is required to change plans.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
