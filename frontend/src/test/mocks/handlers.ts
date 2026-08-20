import { http, HttpResponse } from "msw"

export const handlers = [
  http.post("http://localhost:3000/api/v1/auth/refresh", () =>
    HttpResponse.json(
      {
        error: "Unauthorized",
        message: "A refresh token is required",
        method: "POST",
        path: "/api/v1/auth/refresh",
        requestId: "request-auth-refresh",
        statusCode: 401,
        timestamp: "2026-08-11T00:00:00.000Z",
      },
      { status: 401 }
    )
  ),
  http.get("http://localhost:3000/api/v1/health/ready", () =>
    HttpResponse.json({
      checks: {
        configuration: "up",
        database: "up",
      },
      status: "ok",
      timestamp: "2026-08-11T00:00:00.000Z",
    })
  ),
]
