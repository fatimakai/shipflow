import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { BillingStateResponseDto } from "@/api/generated"

import { CurrentPlanCard } from "./CurrentPlanCard"

const proPlan = {
  annualPriceCents: 29000,
  code: "PRO" as const,
  currency: "usd",
  description: "For growing teams",
  features: ["Unlimited members"],
  monthlyPriceCents: 2900,
  name: "Pro",
}

function renderState(state: Partial<BillingStateResponseDto>) {
  render(
    <CurrentPlanCard
      canManage
      isManagePending={false}
      onManage={vi.fn()}
      state={{
        cancelAtPeriodEnd: false,
        hasPaidAccess: true,
        interval: "MONTHLY",
        plan: proPlan,
        ...state,
      }}
    />
  )
}

describe("CurrentPlanCard", () => {
  it.each([
    ["TRIALING", "Trial", "Trial access"],
    ["ACTIVE", "Active", "next billing period"],
    ["PAST_DUE", "Past due", "Payment is overdue"],
    ["INCOMPLETE", "Incomplete", "Payment setup is incomplete"],
    ["INCOMPLETE_EXPIRED", "Expired", "payment setup expired"],
    ["CANCELED", "Canceled", "previous subscription has ended"],
    ["UNPAID", "Unpaid", "subscription is unpaid"],
    ["PAUSED", "Paused", "subscription is paused"],
  ] as const)("renders the %s lifecycle", (status, label, message) => {
    renderState({
      currentPeriodEnd: "2026-09-13T00:00:00.000Z",
      gracePeriodEndsAt: "2026-08-20T00:00:00.000Z",
      subscriptionStatus: status,
      trialEnd: "2026-08-27T00:00:00.000Z",
    })

    expect(screen.getByText(label)).toBeVisible()
    expect(screen.getByText(new RegExp(message, "i"))).toBeVisible()
  })

  it("shows a scheduled cancellation without removing current access", () => {
    renderState({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-09-13T00:00:00.000Z",
      subscriptionStatus: "ACTIVE",
    })

    expect(
      screen.getByText(/Access continues until cancellation/)
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeVisible()
  })
})
