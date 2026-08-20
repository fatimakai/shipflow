import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createQueryClient } from "@/api/query-client"
import { useOrganizationStore } from "@/stores/organization.store"
import { useAuthStore } from "@/stores/auth.store"
import { server } from "@/test/mocks/server"

import { OrganizationBootstrap } from "./OrganizationBootstrap"

const organization = {
  createdAt: "2026-08-12T00:00:00.000Z",
  currentUserCapabilities: ["organization:read", "membership:read"],
  currentUserRole: "MEMBER",
  id: "11111111-1111-4111-8111-111111111111",
  memberCount: 2,
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
} as const

beforeEach(() =>
  useAuthStore.getState().setSession({
    accessToken: "test-token",
    expiresIn: 900,
    tokenType: "Bearer",
    user: {
      avatarUrl: null,
      displayName: "Test User",
      email: "test@example.com",
      emailVerified: true,
      id: "99999999-9999-4999-8999-999999999999",
    },
  })
)

afterEach(() => {
  useOrganizationStore.getState().clearActiveOrganization()
  useAuthStore.getState().clearSession()
})

function renderBootstrap() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <OrganizationBootstrap>
        <div>Organization application</div>
      </OrganizationBootstrap>
    </QueryClientProvider>
  )
}

describe("OrganizationBootstrap", () => {
  it("selects the first valid organization before rendering tenant UI", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/organizations", () =>
        HttpResponse.json({
          items: [organization],
          pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
        })
      )
    )

    renderBootstrap()

    expect(await screen.findByText("Organization application")).toBeVisible()
    expect(useOrganizationStore.getState().activeOrganizationId).toBe(
      organization.id
    )
  })

  it("creates the first organization from the empty state", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/organizations", () =>
        HttpResponse.json({
          items: [],
          pagination: { limit: 100, page: 1, total: 0, totalPages: 0 },
        })
      ),
      http.post(
        "http://localhost:3000/api/v1/organizations",
        async ({ request }) => {
          expect(await request.json()).toEqual({ name: "Northstar Labs" })
          return HttpResponse.json(organization, { status: 201 })
        }
      )
    )
    const user = userEvent.setup()
    renderBootstrap()

    await user.click(
      await screen.findByRole("button", { name: "Create organization" })
    )
    await user.type(
      screen.getByLabelText("Organization name"),
      "Northstar Labs"
    )
    await user.click(
      screen.getByRole("button", { name: "Create organization" })
    )

    await waitFor(() =>
      expect(screen.getByText("Organization application")).toBeVisible()
    )
    expect(useOrganizationStore.getState().activeOrganizationId).toBe(
      organization.id
    )
  })
})
