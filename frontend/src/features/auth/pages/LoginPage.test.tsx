import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { createQueryClient } from "@/api/query-client"
import { useAuthStore } from "@/stores/auth.store"
import { server } from "@/test/mocks/server"

import { LoginPage } from "./LoginPage"

afterEach(() => useAuthStore.getState().clearSession())

function renderLogin(
  initialEntry: Parameters<typeof MemoryRouter>[0]["initialEntries"] = [
    "/login",
  ]
) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={initialEntry}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={<div>Authenticated dashboard</div>}
          />
          <Route
            path="/invitations/accept"
            element={<div>Invitation return route</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("LoginPage", () => {
  it("authenticates and navigates to the protected application", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/v1/auth/login",
        async ({ request }) => {
          expect(await request.json()).toEqual({
            email: "user@example.com",
            password: "correct horse battery staple",
          })

          return HttpResponse.json({
            accessToken: "login-access-token",
            expiresIn: 900,
            tokenType: "Bearer",
            user: {
              avatarUrl: null,
              displayName: "Login User",
              email: "user@example.com",
              emailVerified: true,
              id: "d3aef285-e012-4636-b739-c449695bf53b",
            },
          })
        }
      )
    )
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText("Email address"), "user@example.com")
    await user.type(
      screen.getByLabelText("Password"),
      "correct horse battery staple"
    )
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText("Authenticated dashboard")
    ).toBeInTheDocument()
    expect(useAuthStore.getState().accessToken).toBe("login-access-token")
  })

  it("shows a throttling message", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/login", () =>
        HttpResponse.json({ message: "Throttled" }, { status: 429 })
      )
    )
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText("Email address"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "wrong password")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText(
        "Too many attempts. Please wait a few minutes and try again."
      )
    ).toBeInTheDocument()
  })

  it("preserves the invitation query string after authentication", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/login", () =>
        HttpResponse.json({
          accessToken: "login-access-token",
          expiresIn: 900,
          tokenType: "Bearer",
          user: {
            avatarUrl: null,
            displayName: "Login User",
            email: "user@example.com",
            emailVerified: true,
            id: "d3aef285-e012-4636-b739-c449695bf53b",
          },
        })
      )
    )
    const user = userEvent.setup()
    renderLogin([
      {
        pathname: "/login",
        state: {
          from: {
            pathname: "/invitations/accept",
            search: "?token=invitation-token",
          },
        },
      },
    ])

    await user.type(screen.getByLabelText("Email address"), "user@example.com")
    await user.type(
      screen.getByLabelText("Password"),
      "correct horse battery staple"
    )
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByText("Invitation return route")).toBeVisible()
  })
})
