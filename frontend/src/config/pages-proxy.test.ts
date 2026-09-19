import { afterEach, describe, expect, it, vi } from "vitest"

import { onRequest } from "../../functions/api/[[path]]"

const pagesOrigin = "https://shipflow-duk.pages.dev"
const renderOrigin = "https://shipflow-rwv0.onrender.com"

afterEach(() => vi.unstubAllGlobals())

describe("Cloudflare Pages API proxy", () => {
  it("forwards an API path and query to the fixed Render origin", async () => {
    const upstream = vi.fn(async () =>
      Response.json({ status: "ok" }, { status: 200 })
    )
    vi.stubGlobal("fetch", upstream)

    const response = await onRequest({
      request: new Request(`${pagesOrigin}/api/v1/health/ready?source=demo`),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ status: "ok" })
    const [request] = upstream.mock.calls[0] as unknown as [Request]
    expect(request.url).toBe(`${renderOrigin}/api/v1/health/ready?source=demo`)
    expect(request.redirect).toBe("manual")
  })

  it("preserves the body, cookies, origin, and Fetch Metadata but drops spoofable proxy headers", async () => {
    let forwardedRequest: Request | undefined
    const upstream = vi.fn(async (request: Request) => {
      forwardedRequest = request.clone()
      return Response.json(
        { message: "A refresh token is required" },
        {
          status: 401,
        }
      )
    })
    vi.stubGlobal("fetch", upstream)

    const response = await onRequest({
      request: new Request(`${pagesOrigin}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "shipflow_refresh=test-token",
          Origin: pagesOrigin,
          "Sec-Fetch-Site": "same-origin",
          "X-Forwarded-For": "203.0.113.1",
          "X-Forwarded-Host": "attacker.example",
        },
        body: "{}",
      }),
    })

    expect(response.status).toBe(401)
    expect(forwardedRequest?.method).toBe("POST")
    expect(await forwardedRequest?.text()).toBe("{}")
    expect(forwardedRequest?.headers.get("cookie")).toBe(
      "shipflow_refresh=test-token"
    )
    expect(forwardedRequest?.headers.get("origin")).toBe(pagesOrigin)
    expect(forwardedRequest?.headers.get("sec-fetch-site")).toBe("same-origin")
    expect(forwardedRequest?.headers.has("x-forwarded-for")).toBe(false)
    expect(forwardedRequest?.headers.has("x-forwarded-host")).toBe(false)
  })

  it("returns OAuth redirects and host-only Set-Cookie headers without following them", async () => {
    const headers = new Headers({
      Location: "https://accounts.google.com/o/oauth2/v2/auth?state=test",
    })
    headers.append(
      "Set-Cookie",
      "shipflow_oauth_state=; Path=/api/v1/auth/oauth; HttpOnly; Secure; SameSite=Lax"
    )
    headers.append(
      "Set-Cookie",
      "shipflow_refresh=test; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax"
    )
    const upstream = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers,
        })
    )
    vi.stubGlobal("fetch", upstream)

    const response = await onRequest({
      request: new Request(`${pagesOrigin}/api/v1/auth/oauth/google`),
    })

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?state=test"
    )
    expect(response.headers.getSetCookie()).toHaveLength(2)
    expect(response.headers.getSetCookie()[0]).toContain(
      "shipflow_oauth_state="
    )
    expect(response.headers.getSetCookie()[1]).toContain(
      "shipflow_refresh=test"
    )
    expect(response.headers.get("set-cookie")).not.toContain("Domain=")
  })

  it("never proxies paths outside the versioned API", async () => {
    const upstream = vi.fn()
    vi.stubGlobal("fetch", upstream)

    const response = await onRequest({
      request: new Request(`${pagesOrigin}/api/other`),
    })

    expect(response.status).toBe(404)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("returns a non-cacheable gateway error when Render cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const response = await onRequest({
      request: new Request(`${pagesOrigin}/api/v1/health/ready`),
    })

    expect(response.status).toBe(502)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.text()).not.toContain("offline")
  })
})
