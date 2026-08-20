import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { createQueryClient } from "@/api/query-client"
import { server } from "@/test/mocks/server"

import { AcceptInvitationPage } from "./AcceptInvitationPage"

describe("AcceptInvitationPage", () => {
  it("accepts the token and opens the application", async () => {
    const token = "a".repeat(48)
    server.use(
      http.post(
        "http://localhost:3000/api/v1/invitations/accept",
        async ({ request }) => {
          expect(await request.json()).toEqual({ token })
          return HttpResponse.json({
            createdAt: "2026-08-12T00:00:00.000Z",
            id: "11111111-1111-4111-8111-111111111111",
            organizationId: "22222222-2222-4222-8222-222222222222",
            role: "MEMBER",
            updatedAt: "2026-08-12T00:00:00.000Z",
            user: {
              avatarUrl: null,
              displayName: "Invited User",
              email: "invited@example.com",
              id: "33333333-3333-4333-8333-333333333333",
            },
          })
        }
      )
    )
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[`/invitations/accept?token=${token}`]}>
          <Routes>
            <Route
              path="/invitations/accept"
              element={<AcceptInvitationPage />}
            />
            <Route path="/dashboard" element={<div>Dashboard ready</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText("Invitation accepted")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Open dashboard" }))
    expect(screen.getByText("Dashboard ready")).toBeVisible()
  })

  it("does not submit an invalid invitation token", async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={["/invitations/accept?token=short"]}>
          <Routes>
            <Route
              path="/invitations/accept"
              element={<AcceptInvitationPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(
      await screen.findByText("This invitation link is invalid.")
    ).toBeVisible()
  })
})
