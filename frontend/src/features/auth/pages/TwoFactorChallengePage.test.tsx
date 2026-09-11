import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

import { createQueryClient } from "@/api/query-client"
import { useAuthStore } from "@/stores/auth.store"
import { server } from "@/test/mocks/server"

import { TwoFactorChallengePage } from "./TwoFactorChallengePage"

const authentication = {
  accessToken: "two-factor-access-token",
  expiresIn: 900,
  tokenType: "Bearer",
  user: {
    avatarUrl: null,
    displayName: "Secured User",
    email: "secured@example.com",
    emailVerified: true,
    id: "d3aef285-e012-4636-b739-c449695bf53b",
  },
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location-hash">{location.hash}</span>
}

function renderChallenge(
  initialEntry:
    | string
    | {
        pathname: string
        hash?: string
        state?: unknown
      }
) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <Routes>
          <Route path="/auth/two-factor" element={<TwoFactorChallengePage />} />
          <Route
            path="/invitations/accept"
            element={<div>Invitation accepted</div>}
          />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => useAuthStore.getState().clearSession())

describe("TwoFactorChallengePage", () => {
  it("verifies a challenge and restores the requested return path", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/v1/auth/2fa/challenge/verify",
        async ({ request }) => {
          expect(await request.json()).toEqual({
            challengeToken: "password-login-challenge-token",
            code: "ABCD-EFGH",
          })
          return HttpResponse.json(authentication)
        }
      )
    )
    const user = userEvent.setup()
    renderChallenge({
      pathname: "/auth/two-factor",
      state: {
        challengeToken: "password-login-challenge-token",
        from: {
          pathname: "/invitations/accept",
          search: "?token=invitation-token",
        },
      },
    })

    await user.type(
      screen.getByLabelText("Authenticator or recovery code"),
      "ABCD-EFGH"
    )
    await user.click(
      screen.getByRole("button", { name: "Verify and continue" })
    )

    expect(await screen.findByText("Invitation accepted")).toBeVisible()
    expect(useAuthStore.getState().accessToken).toBe("two-factor-access-token")
  })

  it("accepts an OAuth fragment challenge and removes it from the URL", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/v1/auth/2fa/challenge/verify",
        async ({ request }) => {
          expect(await request.json()).toEqual({
            challengeToken: "oauth-login-challenge-token",
            code: "123456",
          })
          return HttpResponse.json(authentication)
        }
      )
    )
    const user = userEvent.setup()
    renderChallenge("/auth/two-factor#challenge=oauth-login-challenge-token")

    await waitFor(() =>
      expect(screen.getByTestId("location-hash")).toHaveTextContent("")
    )
    await user.type(
      screen.getByLabelText("Authenticator or recovery code"),
      "123456"
    )
    await user.click(
      screen.getByRole("button", { name: "Verify and continue" })
    )

    expect(await screen.findByText("Dashboard")).toBeVisible()
  })

  it("requires a new sign-in when no challenge is present", () => {
    renderChallenge("/auth/two-factor")

    expect(screen.getByText("Verification link unavailable")).toBeVisible()
    expect(
      screen.getByRole("link", { name: "Return to sign in" })
    ).toHaveAttribute("href", "/login")
  })
})
