import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"

import { server } from "@/test/mocks/server"

import { apiClient, configureApiAuth } from "./api-client"
import type { ReadinessResponseDto } from "./generated"

afterEach(() => {
  configureApiAuth({
    clearSession: () => undefined,
    getAccessToken: () => null,
  })
})

describe("apiClient", () => {
  it("returns a typed JSON response", async () => {
    const result = await apiClient.get<ReadinessResponseDto>("/health/ready")

    expect(result.status).toBe("ok")
    expect(result.checks.database).toBe("up")
  })

  it("normalizes the backend error envelope", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/health/ready", () =>
        HttpResponse.json(
          {
            error: "Service Unavailable",
            message: ["Database is unavailable"],
            method: "GET",
            path: "/api/v1/health/ready",
            requestId: "request-123",
            statusCode: 503,
            timestamp: "2026-08-11T00:00:00.000Z",
          },
          { status: 503 }
        )
      )
    )

    const request = apiClient.get("/health/ready")

    await expect(request).rejects.toMatchObject({
      message: "Database is unavailable",
      requestId: "request-123",
      statusCode: 503,
    })
  })

  it("coordinates one token refresh for concurrent unauthorized requests", async () => {
    const refreshAccessToken = vi.fn(async () => "new-token")

    configureApiAuth({
      clearSession: vi.fn(),
      getAccessToken: () => "expired-token",
      refreshAccessToken,
    })

    server.use(
      http.get("http://localhost:3000/api/v1/protected", ({ request }) => {
        if (request.headers.get("authorization") === "Bearer new-token") {
          return HttpResponse.json({ ok: true })
        }

        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 })
      })
    )

    const requests = [
      apiClient.get<{ ok: boolean }>("/protected", { auth: true }),
      apiClient.get<{ ok: boolean }>("/protected", { auth: true }),
    ]

    await expect(Promise.all(requests)).resolves.toEqual([
      { ok: true },
      { ok: true },
    ])
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
  })
})
