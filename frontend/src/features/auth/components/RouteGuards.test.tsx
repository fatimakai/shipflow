import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { useAuthStore } from "@/stores/auth.store"

import { ProtectedRoute, PublicOnlyRoute } from "./RouteGuards"

afterEach(() => useAuthStore.getState().clearSession())

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to sign in", async () => {
    useAuthStore.getState().clearSession()

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Private dashboard</div>} />
          </Route>
          <Route path="/login" element={<div>Sign in route</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText("Sign in route")).toBeInTheDocument()
    expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument()
  })
})

describe("PublicOnlyRoute", () => {
  it("preserves a safe protected destination after authentication", async () => {
    useAuthStore.getState().setSession({
      accessToken: "access-token",
      expiresIn: 900,
      tokenType: "Bearer",
      user: {
        avatarUrl: null,
        displayName: "Auth User",
        email: "auth@example.com",
        emailVerified: true,
        id: "11111111-1111-4111-8111-111111111111",
      },
    })

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: {
              from: {
                pathname: "/billing",
                search: "?checkout=canceled",
              },
            },
          },
        ]}
      >
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Sign in route</div>} />
          </Route>
          <Route path="/billing" element={<div>Billing destination</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText("Billing destination")).toBeInTheDocument()
  })
})
