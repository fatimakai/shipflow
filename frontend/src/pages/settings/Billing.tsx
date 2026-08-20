import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import type { CreateCheckoutSessionDto } from "@/api/generated"
import { CurrentPlanCard } from "@/components/billing/CurrentPlanCard"
import { PlanCatalog } from "@/components/billing/PlanCatalog"
import { PlanFeaturesCard } from "@/components/billing/PlanFeaturesCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { billingApi } from "@/features/billing/billing-api"
import { getBillingErrorMessage } from "@/features/billing/billing-errors"
import {
  useBillingPlans,
  useBillingState,
} from "@/features/billing/billing-queries"
import { redirectToHostedBilling } from "@/features/billing/billing-redirect"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"
import { useActiveOrganization } from "@/features/organizations/organization-queries"
import { recoverOrganizationAuthorization } from "@/features/organizations/organization-session"

type BillingInterval = CreateCheckoutSessionDto["interval"]
type CheckoutReturn = "canceled" | "success" | null

interface BillingProps {
  redirect?: (url: string) => void
}

function readCheckoutReturn(value: string | null): CheckoutReturn {
  return value === "success" || value === "canceled" ? value : null
}

export function Billing({ redirect = redirectToHostedBilling }: BillingProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const organization = useActiveOrganization()
  const organizationId = organization?.id ?? null
  const canManageBilling = hasOrganizationCapability(
    organization,
    "billing:manage"
  )
  const [interval, setInterval] = useState<BillingInterval>("ANNUAL")
  const [checkoutReturn, setCheckoutReturn] = useState<CheckoutReturn>(() =>
    readCheckoutReturn(searchParams.get("checkout"))
  )
  const [syncTimedOut, setSyncTimedOut] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const shouldPoll = checkoutReturn === "success" && !syncTimedOut
  const billingState = useBillingState(organizationId, { poll: shouldPoll })
  const plans = useBillingPlans()

  const checkout = useMutation({
    mutationFn: (selectedInterval: BillingInterval) =>
      billingApi.checkout(organizationId!, { interval: selectedInterval }),
    onError: (error) =>
      setActionError(
        getBillingErrorMessage(
          error,
          "Unable to start Checkout. Please try again."
        )
      ),
    onSuccess: (session) => {
      try {
        redirect(session.url)
      } catch (error) {
        setActionError(getBillingErrorMessage(error))
      }
    },
  })
  const portal = useMutation({
    mutationFn: () => billingApi.portal(organizationId!),
    onError: (error) =>
      setActionError(
        getBillingErrorMessage(
          error,
          "Unable to open the billing portal. Please try again."
        )
      ),
    onSuccess: (session) => {
      try {
        redirect(session.url)
      } catch (error) {
        setActionError(getBillingErrorMessage(error))
      }
    },
  })

  useEffect(() => {
    if (
      searchParams.has("checkout") ||
      searchParams.has("session_id") ||
      searchParams.has("stub_session_id")
    ) {
      navigate("/billing", { replace: true })
    }
  }, [navigate, searchParams])

  useEffect(() => {
    if (checkoutReturn !== "success" || billingState.data?.hasPaidAccess) {
      return
    }

    const timeout = window.setTimeout(() => setSyncTimedOut(true), 30_000)
    return () => window.clearTimeout(timeout)
  }, [billingState.data?.hasPaidAccess, checkoutReturn])

  useEffect(() => {
    if (!organizationId || !billingState.error) return
    void recoverOrganizationAuthorization(
      billingState.error,
      organizationId,
      queryClient
    )
  }, [billingState.error, organizationId, queryClient])

  if (!organization || !organizationId) return null

  const startCheckout = (selectedInterval: BillingInterval) => {
    setActionError(null)
    checkout.mutate(selectedInterval)
  }
  const openPortal = () => {
    setActionError(null)
    portal.mutate()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Billing
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage the plan and subscription for {organization.name}.
        </p>
      </div>

      {checkoutReturn && (
        <div
          className={
            checkoutReturn === "canceled"
              ? "flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary p-3.5 text-sm"
              : billingState.data?.hasPaidAccess
                ? "flex items-start justify-between gap-3 rounded-lg border border-success/20 bg-success/10 p-3.5 text-sm text-success"
                : "flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 p-3.5 text-sm text-foreground"
          }
          role="status"
        >
          <div className="flex items-start gap-2.5">
            {checkoutReturn === "canceled" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : billingState.data?.hasPaidAccess ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-medium">
                {checkoutReturn === "canceled"
                  ? "Checkout canceled"
                  : billingState.data?.hasPaidAccess
                    ? "Subscription confirmed"
                    : syncTimedOut
                      ? "Subscription confirmation is delayed"
                      : "Confirming your subscription"}
              </p>
              <p className="mt-0.5 text-xs opacity-80">
                {checkoutReturn === "canceled"
                  ? "No billing changes were made."
                  : billingState.data?.hasPaidAccess
                    ? "Your workspace entitlements are now up to date."
                    : syncTimedOut
                      ? "The provider update has not arrived yet. Refresh this page in a moment."
                      : "The page will update when the billing provider confirmation arrives."}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCheckoutReturn(null)}
            aria-label="Dismiss billing status"
            title="Dismiss"
          >
            <X />
          </Button>
        </div>
      )}

      {actionError && (
        <div
          className="flex items-start justify-between gap-3 rounded-lg border border-danger/20 bg-danger/10 p-3.5 text-sm text-danger"
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setActionError(null)}
            aria-label="Dismiss billing error"
            title="Dismiss"
          >
            <X />
          </Button>
        </div>
      )}

      {billingState.isPending ? (
        <Card aria-label="Loading billing state">
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </CardContent>
        </Card>
      ) : billingState.isError ? (
        <Card>
          <CardContent className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="mb-3 h-6 w-6 text-danger" />
            <h2 className="font-heading text-lg font-semibold">
              Billing could not be loaded
            </h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              {getBillingErrorMessage(billingState.error)}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => void billingState.refetch()}
            >
              <RefreshCw />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <CurrentPlanCard
            state={billingState.data}
            canManage={canManageBilling}
            isManagePending={portal.isPending}
            onManage={openPortal}
          />

          <PlanFeaturesCard plan={billingState.data.plan} />

          {plans.isPending ? (
            <div
              className="grid gap-4 lg:grid-cols-2"
              aria-label="Loading plans"
            >
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          ) : plans.isError ? (
            <Card>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium text-foreground">
                    Available plans could not be loaded
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {getBillingErrorMessage(plans.error)}
                  </p>
                </div>
                <Button variant="outline" onClick={() => void plans.refetch()}>
                  <RefreshCw />
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : plans.data.items.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No billing plans are currently available.
              </CardContent>
            </Card>
          ) : (
            <PlanCatalog
              canManage={canManageBilling}
              checkoutPending={checkout.isPending}
              interval={interval}
              onCheckout={startCheckout}
              onIntervalChange={setInterval}
              onManage={openPortal}
              plans={plans.data.items}
              portalPending={portal.isPending}
              state={billingState.data}
            />
          )}
        </>
      )}
    </div>
  )
}
