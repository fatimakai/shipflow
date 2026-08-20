import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it } from "vitest"

import { server } from "@/test/mocks/server"
import { useAuthStore } from "@/stores/auth.store"

import { restoreSession } from "./auth-session"

afterEach(() => {
  useAuthStore.getState().clearSession()
})

describe("restoreSession", () => {
  it("restores an authenticated session without persistent browser storage", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json({
          accessToken: "restored-access-token",
          expiresIn: 900,
          tokenType: "Bearer",
          user: {
            avatarUrl: null,
            displayName: "Restored User",
            email: "restored@example.com",
            emailVerified: true,
            id: "8ce7296a-3328-4ac7-a4ad-22bc0e6f811e",
          },
        })
      )
    )

    await restoreSession()

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "restored-access-token",
      status: "authenticated",
      user: { email: "restored@example.com" },
    })
    expect(localStorage).toHaveLength(0)
    expect(sessionStorage).toHaveLength(0)
  })

  it("finishes unauthenticated when no refresh session exists", async () => {
    await restoreSession()

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      status: "unauthenticated",
      user: null,
    })
  })

  it("shows a recoverable state when the API is offline", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.error()
      )
    )

    await restoreSession()

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      status: "error",
      user: null,
    })
    expect(useAuthStore.getState().restoreError).toContain("unreachable")
  })
})
