import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it } from "vitest"

import type { OrganizationListResponseDto } from "@/api/generated"
import { createQueryClient } from "@/api/query-client"
import { organizationKeys } from "@/features/organizations/organization-queries"
import { useOrganizationStore } from "@/stores/organization.store"
import { server } from "@/test/mocks/server"

import { Notifications } from "./Notifications"

const organizationId = "11111111-1111-4111-8111-111111111111"

function renderNotifications(entry = "/notifications") {
  const queryClient = createQueryClient()
  queryClient.setQueryData<OrganizationListResponseDto>(organizationKeys.list, {
    items: [
      {
        createdAt: "2026-08-01T00:00:00.000Z",
        currentUserCapabilities: [
          "organization:read",
          "membership:read",
          "billing:read",
          "notification:read",
          "notification:manage",
        ],
        currentUserRole: "OWNER",
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

  render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/notifications/settings" element={<Notifications />} />
          <Route path="/team" element={<h1>Team destination</h1>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

function notificationHandlers() {
  server.use(
    http.get("http://localhost:3000/api/v1/notifications", ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get("cursor") === "next-page") {
        return HttpResponse.json({
          items: [
            {
              actionPath: "/billing",
              category: "BILLING",
              createdAt: "2026-08-12T10:00:00.000Z",
              expiresAt: "2026-09-12T10:00:00.000Z",
              id: "notification-2",
              message: "The latest invoice is ready.",
              metadata: {},
              organizationId,
              readAt: "2026-08-12T11:00:00.000Z",
              title: "Invoice ready",
              type: "BILLING_TRIAL_STARTED",
            },
          ],
          nextCursor: null,
        })
      }

      return HttpResponse.json({
        items: [
          {
            actionPath: "/team",
            category: "ORGANIZATION",
            createdAt: "2026-08-13T10:00:00.000Z",
            expiresAt: "2026-09-13T10:00:00.000Z",
            id: "notification-1",
            message: "Sam joined Northstar Labs.",
            metadata: {},
            organizationId,
            readAt: null,
            title: "Member joined",
            type: "ORGANIZATION_INVITATION_ACCEPTED",
          },
        ],
        nextCursor: "next-page",
      })
    }),
    http.get("http://localhost:3000/api/v1/notifications/unread-count", () =>
      HttpResponse.json({ count: 1 })
    )
  )
}

afterEach(() => useOrganizationStore.getState().clearActiveOrganization())

describe("Notifications", () => {
  it("loads pages, marks a notification read, and follows its safe link", async () => {
    notificationHandlers()
    let markedId: string | undefined
    server.use(
      http.patch(
        "http://localhost:3000/api/v1/notifications/:notificationId/read",
        ({ params }) => {
          markedId = String(params.notificationId)
          return HttpResponse.json({ readAt: "2026-08-13T12:00:00.000Z" })
        }
      )
    )
    const user = userEvent.setup()
    renderNotifications()

    expect(await screen.findByText("Member joined")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByText("Invoice ready")).toBeVisible()

    await user.click(
      screen.getByRole("button", {
        name: /^Member joinedSam joined Northstar Labs/,
      })
    )

    expect(
      await screen.findByRole("heading", { name: "Team destination" })
    ).toBeVisible()
    expect(markedId).toBe("notification-1")
  })

  it("marks all notifications read for the active organization", async () => {
    notificationHandlers()
    let body: unknown
    server.use(
      http.post(
        "http://localhost:3000/api/v1/notifications/mark-all-read",
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ updatedCount: 1 })
        }
      )
    )
    const user = userEvent.setup()
    renderNotifications()

    await user.click(
      await screen.findByRole("button", { name: "Mark all as read" })
    )
    await waitFor(() => expect(body).toEqual({ organizationId }))
  })

  it("loads and saves the supported organization preference", async () => {
    notificationHandlers()
    let body: unknown
    server.use(
      http.get("http://localhost:3000/api/v1/notifications/preferences", () =>
        HttpResponse.json({
          billingEnabled: true,
          organizationEnabled: true,
          securityEnabled: true,
        })
      ),
      http.patch(
        "http://localhost:3000/api/v1/notifications/preferences",
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            billingEnabled: true,
            organizationEnabled: false,
            securityEnabled: true,
          })
        }
      )
    )
    const user = userEvent.setup()
    renderNotifications("/notifications/settings")

    const organizationSwitch = await screen.findByRole("switch", {
      name: "Organization updates",
    })
    expect(
      screen.getByRole("switch", { name: "Security alerts" })
    ).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByRole("switch", { name: "Billing alerts" })
    ).toHaveAttribute("aria-disabled", "true")

    await user.click(organizationSwitch)
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(body).toEqual({ organizationEnabled: false }))
  })
})
