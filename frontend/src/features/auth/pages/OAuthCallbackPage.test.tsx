import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { useAuthStore } from "@/stores/auth.store"

import { rememberAuthReturnPath } from "../auth-return-path"
import { OAuthCallbackPage } from "./OAuthCallbackPage"

afterEach(() => {
  sessionStorage.clear()
  useAuthStore.getState().clearSession()
})

describe("OAuthCallbackPage", () => {
  it("returns an authenticated OAuth user to the pending invitation", async () => {
    rememberAuthReturnPath({
      pathname: "/invitations/accept",
      search: "?token=single-use-token",
    })
    useAuthStore.getState().setSession({
      accessToken: "oauth-access-token",
      expiresIn: 900,
      tokenType: "Bearer",
      user: {
        avatarUrl: null,
        displayName: "Invited User",
        email: "invited@example.com",
        emailVerified: true,
        id: "d3aef285-e012-4636-b739-c449695bf53b",
      },
    })

    render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <Routes>
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
          <Route
            path="/invitations/accept"
            element={<div>Invitation return route</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText("Invitation return route")).toBeVisible()
    expect(sessionStorage).toHaveLength(0)
  })
})
