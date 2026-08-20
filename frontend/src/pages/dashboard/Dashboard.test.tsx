import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it } from "vitest"

import type { OrganizationListResponseDto } from "@/api/generated"
import { createQueryClient } from "@/api/query-client"
import { organizationKeys } from "@/features/organizations/organization-queries"
import { useOrganizationStore } from "@/stores/organization.store"
import { server } from "@/test/mocks/server"

import { Dashboard } from "./Dashboard"

const organizationId = "11111111-1111-4111-8111-111111111111"

function renderDashboard(
  capabilities: OrganizationListResponseDto["items"][number]["currentUserCapabilities"]
) {
  const queryClient = createQueryClient()
  queryClient.setQueryData<OrganizationListResponseDto>(organizationKeys.list, {
    items: [
      {
        createdAt: "2026-08-01T00:00:00.000Z",
        currentUserCapabilities: capabilities,
        currentUserRole: capabilities.includes("billing:read")
          ? "OWNER"
          : "MEMBER",
        id: organizationId,
        memberCount: 2,
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
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
  })
  useOrganizationStore.getState().setActiveOrganization(organizationId)

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

function useMemberHandler() {
  server.use(
    http.get(
      `http://localhost:3000/api/v1/organizations/${organizationId}/members`,
      () =>
        HttpResponse.json({
          items: [
            {
              createdAt: "2026-08-10T00:00:00.000Z",
              id: "22222222-2222-4222-8222-222222222222",
              organizationId,
              role: "OWNER",
              updatedAt: "2026-08-10T00:00:00.000Z",
              user: {
                avatarUrl: null,
                displayName: "Alex Morgan",
                email: "alex@example.com",
                id: "33333333-3333-4333-8333-333333333333",
              },
            },
          ],
          pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
        })
    )
  )
}

afterEach(() => useOrganizationStore.getState().clearActiveOrganization())

describe("Dashboard", () => {
  it("renders real organization summaries without unsupported analytics", async () => {
    useMemberHandler()
    server.use(
      http.get(
        `http://localhost:3000/api/v1/organizations/${organizationId}/files/usage`,
        () =>
          HttpResponse.json({
            maxBytes: 10 * 1024 * 1024,
            maxFiles: 100,
            usedBytes: 1024 * 1024,
            usedFiles: 4,
          })
      ),
      http.get("http://localhost:3000/api/v1/notifications/unread-count", () =>
        HttpResponse.json({ count: 3 })
      ),
      http.get(
        `http://localhost:3000/api/v1/organizations/${organizationId}/billing`,
        () =>
          HttpResponse.json({
            cancelAtPeriodEnd: false,
            hasPaidAccess: true,
            interval: "MONTHLY",
            plan: {
              annualPriceCents: 9900,
              code: "PRO",
              currency: "USD",
              description: "For growing teams",
              features: ["More storage"],
              monthlyPriceCents: 990,
              name: "Pro",
            },
            subscriptionStatus: "ACTIVE",
          })
      )
    )

    renderDashboard([
      "membership:read",
      "file:read",
      "notification:read",
      "billing:read",
    ])

    expect(
      screen.getByRole("heading", { name: "Northstar Labs" })
    ).toBeVisible()
    expect(await screen.findAllByText("Alex Morgan")).not.toHaveLength(0)
    expect(await screen.findByText("1.0 MB")).toBeVisible()
    expect(await screen.findByText("Pro")).toBeVisible()
    expect(await screen.findByText("3")).toBeVisible()
    expect(screen.queryByText("Total Revenue")).not.toBeInTheDocument()
    expect(screen.queryByText("Churn Rate")).not.toBeInTheDocument()
  })

  it("keeps team data usable when the storage summary fails", async () => {
    useMemberHandler()
    server.use(
      http.get(
        `http://localhost:3000/api/v1/organizations/${organizationId}/files/usage`,
        () =>
          HttpResponse.json(
            { message: "Storage service unavailable" },
            { status: 503 }
          )
      ),
      http.get("http://localhost:3000/api/v1/notifications/unread-count", () =>
        HttpResponse.json({ count: 0 })
      )
    )

    renderDashboard(["membership:read", "file:read", "notification:read"])

    expect(await screen.findAllByText("Alex Morgan")).not.toHaveLength(0)
    expect(
      await screen.findByText("Storage usage is temporarily unavailable.")
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Retry storage used" })
    ).toBeVisible()
  })
})
