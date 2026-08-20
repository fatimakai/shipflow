import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  BillingStateResponseDto,
  OrganizationListResponseDto,
} from "@/api/generated"
import { createQueryClient } from "@/api/query-client"
import { organizationKeys } from "@/features/organizations/organization-queries"
import { useOrganizationStore } from "@/stores/organization.store"
import { server } from "@/test/mocks/server"

import { Billing } from "./Billing"

const organizationId = "11111111-1111-4111-8111-111111111111"

const freePlan = {
  annualPriceCents: 0,
  code: "FREE" as const,
  currency: "usd",
  description: "Core workspace features",
  features: ["Up to 3 members", "1 GB storage"],
  monthlyPriceCents: 0,
  name: "Free",
}

const proPlan = {
  annualPriceCents: 29000,
  code: "PRO" as const,
  currency: "usd",
  description: "For growing teams",
  features: ["Unlimited members", "100 GB storage"],
  monthlyPriceCents: 2900,
  name: "Pro",
}

const freeState: BillingStateResponseDto = {
  cancelAtPeriodEnd: false,
  hasPaidAccess: false,
  plan: freePlan,
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>
}

function renderBilling({
  capabilities = ["billing:read", "billing:manage"],
  entry = "/billing",
  redirect = vi.fn(),
}: {
  capabilities?: OrganizationListResponseDto["items"][number]["currentUserCapabilities"]
  entry?: string
  redirect?: (url: string) => void
} = {}) {
  const queryClient = createQueryClient()
  queryClient.setQueryData<OrganizationListResponseDto>(organizationKeys.list, {
    items: [
      {
        createdAt: "2026-08-13T00:00:00.000Z",
        currentUserCapabilities: capabilities,
        currentUserRole: "OWNER",
        id: organizationId,
        memberCount: 1,
        membershipId: "22222222-2222-4222-8222-222222222222",
        name: "Northstar Labs",
        owner: {
          avatarUrl: null,
          displayName: "Alex Morgan",
          email: "alex@example.com",
          id: "33333333-3333-4333-8333-333333333333",
        },
        ownerId: "33333333-3333-4333-8333-333333333333",
        slug: "northstar-labs",
        updatedAt: "2026-08-13T00:00:00.000Z",
      },
    ],
    pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
  })
  useOrganizationStore.getState().setActiveOrganization(organizationId)

  render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/billing"
            element={
              <>
                <Billing redirect={redirect} />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )

  return { redirect }
}

function mockBilling(state: BillingStateResponseDto = freeState) {
  server.use(
    http.get("http://localhost:3000/api/v1/billing/plans", () =>
      HttpResponse.json({ items: [freePlan, proPlan] })
    ),
    http.get(
      `http://localhost:3000/api/v1/organizations/${organizationId}/billing`,
      () => HttpResponse.json(state)
    )
  )
}

afterEach(() => useOrganizationStore.getState().clearActiveOrganization())

describe("Billing", () => {
  it("loads real plans and starts annual Checkout", async () => {
    mockBilling()
    let checkoutBody: unknown
    server.use(
      http.post(
        `http://localhost:3000/api/v1/organizations/${organizationId}/billing/checkout-session`,
        async ({ request }) => {
          checkoutBody = await request.json()
          return HttpResponse.json(
            {
              expiresAt: "2026-08-13T01:00:00.000Z",
              sessionId: "cs_test_123",
              url: "https://checkout.stripe.test/session",
            },
            { status: 201 }
          )
        }
      )
    )
    const user = userEvent.setup()
    const { redirect } = renderBilling()

    expect(
      await screen.findAllByText("Core workspace features")
    ).not.toHaveLength(0)
    expect(
      await screen.findByRole("button", { name: "Choose Pro" })
    ).toBeVisible()
    expect(screen.queryByText("Payment Method")).not.toBeInTheDocument()
    expect(screen.queryByText("Billing History")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Choose Pro" }))

    await waitFor(() => expect(checkoutBody).toEqual({ interval: "ANNUAL" }))
    expect(redirect).toHaveBeenCalledWith(
      "https://checkout.stripe.test/session"
    )
  })

  it("opens the portal for an active subscription", async () => {
    mockBilling({
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-09-13T00:00:00.000Z",
      hasPaidAccess: true,
      interval: "MONTHLY",
      plan: proPlan,
      subscriptionStatus: "ACTIVE",
    })
    server.use(
      http.post(
        `http://localhost:3000/api/v1/organizations/${organizationId}/billing/portal-session`,
        () =>
          HttpResponse.json(
            { url: "https://billing.stripe.test/portal" },
            { status: 201 }
          )
      )
    )
    const user = userEvent.setup()
    const { redirect } = renderBilling()

    await user.click(
      await screen.findByRole("button", { name: "Manage billing" })
    )

    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith(
        "https://billing.stripe.test/portal"
      )
    )
  })

  it("keeps billing read-only without management capability", async () => {
    mockBilling()
    renderBilling({ capabilities: ["billing:read"] })

    expect(
      await screen.findByRole("button", { name: "Choose Pro" })
    ).toBeDisabled()
    expect(
      screen.getByText(/Billing-management permission is required/)
    ).toBeVisible()
  })

  it("shows a canceled return and removes return parameters from history", async () => {
    mockBilling()
    renderBilling({
      entry:
        "/billing?checkout=canceled&session_id=cs_test_sensitive&stub_session_id=cs_stub_sensitive",
    })

    expect(await screen.findByText("Checkout canceled")).toBeVisible()
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("")
    )
  })

  it("shows a retry state when the billing summary is unavailable", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/billing/plans", () =>
        HttpResponse.json({ items: [freePlan, proPlan] })
      ),
      http.get(
        `http://localhost:3000/api/v1/organizations/${organizationId}/billing`,
        () => HttpResponse.json({ message: "Unavailable" }, { status: 503 })
      )
    )
    renderBilling()

    expect(
      await screen.findByRole(
        "heading",
        { name: "Billing could not be loaded" },
        { timeout: 4_000 }
      )
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible()
  })
})
