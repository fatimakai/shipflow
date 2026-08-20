import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import type { OrganizationListResponseDto } from "@/api/generated"
import { createQueryClient } from "@/api/query-client"
import { organizationKeys } from "@/features/organizations/organization-queries"
import { useOrganizationStore } from "@/stores/organization.store"

import type { OrganizationCapability } from "../organization-capabilities"
import { OrganizationCapabilityRoute } from "./OrganizationCapabilityRoute"

const organizationId = "11111111-1111-4111-8111-111111111111"

function renderRoute(capabilities: OrganizationCapability[]) {
  const queryClient = createQueryClient()
  queryClient.setQueryData<OrganizationListResponseDto>(organizationKeys.list, {
    items: [
      {
        createdAt: "2026-08-12T00:00:00.000Z",
        currentUserCapabilities: capabilities,
        currentUserRole: capabilities.includes("billing:read")
          ? "OWNER"
          : "ADMIN",
        id: organizationId,
        memberCount: 1,
        membershipId: "22222222-2222-4222-8222-222222222222",
        name: "Northstar Labs",
        owner: {
          avatarUrl: null,
          displayName: "Owner User",
          email: "owner@example.com",
          id: "33333333-3333-4333-8333-333333333333",
        },
        ownerId: "33333333-3333-4333-8333-333333333333",
        slug: "northstar-labs",
        updatedAt: "2026-08-12T00:00:00.000Z",
      },
    ],
    pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
  })
  useOrganizationStore.getState().setActiveOrganization(organizationId)

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/billing"]}>
        <Routes>
          <Route
            element={<OrganizationCapabilityRoute capability="billing:read" />}
          >
            <Route path="/billing" element={<div>Billing content</div>} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard content</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => useOrganizationStore.getState().clearActiveOrganization())

describe("OrganizationCapabilityRoute", () => {
  it("renders a tenant route when the backend capability is present", () => {
    renderRoute(["organization:read", "billing:read"])

    expect(screen.getByText("Billing content")).toBeVisible()
  })

  it("shows a restricted state for a direct URL without access", () => {
    renderRoute(["organization:read"])

    expect(
      screen.getByRole("heading", { name: "Access restricted" })
    ).toBeVisible()
    expect(screen.queryByText("Billing content")).not.toBeInTheDocument()
  })
})
