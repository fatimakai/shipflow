import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it } from "vitest"

import type { OrganizationListResponseDto } from "@/api/generated"
import { createQueryClient } from "@/api/query-client"
import { organizationKeys } from "@/features/organizations/organization-queries"
import { useOrganizationStore } from "@/stores/organization.store"
import { server } from "@/test/mocks/server"

import { Team } from "./Team"

const organizationId = "11111111-1111-4111-8111-111111111111"

function renderTeam(
  capabilities: OrganizationListResponseDto["items"][number]["currentUserCapabilities"]
) {
  const queryClient = createQueryClient()
  queryClient.setQueryData<OrganizationListResponseDto>(organizationKeys.list, {
    items: [
      {
        createdAt: "2026-08-12T00:00:00.000Z",
        currentUserCapabilities: capabilities,
        currentUserRole: capabilities.includes("invitation:read")
          ? "ADMIN"
          : "MEMBER",
        id: organizationId,
        memberCount: 2,
        membershipId: "22222222-2222-4222-8222-222222222222",
        name: "Northstar Labs",
        owner: {
          avatarUrl: null,
          displayName: null,
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

  return render(
    <QueryClientProvider client={queryClient}>
      <Team />
    </QueryClientProvider>
  )
}

afterEach(() => useOrganizationStore.getState().clearActiveOrganization())

describe("Team", () => {
  it("renders backend members and pending invitations", async () => {
    server.use(
      http.get(
        `http://localhost:3000/api/v1/organizations/${organizationId}/members`,
        () =>
          HttpResponse.json({
            items: [
              {
                createdAt: "2026-08-01T00:00:00.000Z",
                id: "22222222-2222-4222-8222-222222222222",
                organizationId,
                role: "ADMIN",
                updatedAt: "2026-08-01T00:00:00.000Z",
                user: {
                  avatarUrl: null,
                  displayName: "Alex Morgan",
                  email: "alex@example.com",
                  id: "44444444-4444-4444-8444-444444444444",
                },
              },
            ],
            pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
          })
      ),
      http.get(
        `http://localhost:3000/api/v1/organizations/${organizationId}/invitations`,
        () =>
          HttpResponse.json({
            items: [
              {
                acceptedAt: null,
                createdAt: "2026-08-10T00:00:00.000Z",
                email: "invitee@example.com",
                expiresAt: "2026-08-17T00:00:00.000Z",
                id: "55555555-5555-4555-8555-555555555555",
                invitedBy: {
                  avatarUrl: null,
                  displayName: "Alex Morgan",
                  email: "alex@example.com",
                  id: "44444444-4444-4444-8444-444444444444",
                },
                organizationId,
                revokedAt: null,
                role: "MEMBER",
                status: "PENDING",
                updatedAt: "2026-08-10T00:00:00.000Z",
              },
            ],
            pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
          })
      )
    )

    renderTeam([
      "membership:read",
      "invitation:read",
      "invitation:create",
      "invitation:resend",
      "invitation:revoke",
    ])

    expect(await screen.findByText("Alex Morgan")).toBeVisible()
    expect(await screen.findByText(/Pending invitations \(1\)/)).toBeVisible()
  })

  it("does not request or expose invitations without the capability", async () => {
    server.use(
      http.get(
        `http://localhost:3000/api/v1/organizations/${organizationId}/members`,
        () =>
          HttpResponse.json({
            items: [],
            pagination: { limit: 100, page: 1, total: 0, totalPages: 0 },
          })
      )
    )

    renderTeam(["membership:read"])

    expect(await screen.findByText("No members yet")).toBeVisible()
    expect(screen.queryByText(/Pending invitations/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Invite member" })
    ).not.toBeInTheDocument()
  })

  it("clears the active tenant after backend membership loss", async () => {
    server.use(
      http.get(
        `http://localhost:3000/api/v1/organizations/${organizationId}/members`,
        () =>
          HttpResponse.json(
            { message: "Organization membership is required" },
            { status: 403 }
          )
      ),
      http.get("http://localhost:3000/api/v1/organizations", () =>
        HttpResponse.json({
          items: [],
          pagination: { limit: 100, page: 1, total: 0, totalPages: 0 },
        })
      )
    )

    renderTeam(["membership:read"])

    await waitFor(() =>
      expect(useOrganizationStore.getState().activeOrganizationId).toBeNull()
    )
  })
})
