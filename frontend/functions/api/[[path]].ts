const RENDER_API_ORIGIN = "https://shipflow-rwv0.onrender.com"

interface PagesRequestContext {
  request: Request
}

export async function onRequest({
  request,
}: PagesRequestContext): Promise<Response> {
  const incomingUrl = new URL(request.url)

  if (!incomingUrl.pathname.startsWith("/api/v1/")) {
    return new Response("Not found", { status: 404 })
  }

  const upstreamUrl = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    RENDER_API_ORIGIN
  )
  const headers = new Headers(request.headers)

  // Let Render and Cloudflare set transport headers. In particular, do not
  // forward a caller-supplied address or host as a trusted proxy assertion.
  for (const header of [
    "host",
    "forwarded",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "cf-connecting-ip",
  ]) {
    headers.delete(header)
  }

  const upstreamInit: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    redirect: "manual",
    duplex: "half",
  }
  const upstreamRequest = new Request(upstreamUrl, upstreamInit)

  try {
    const upstreamResponse = await fetch(upstreamRequest)
    const response = new Response(upstreamResponse.body, upstreamResponse)
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch {
    return new Response("The API is temporarily unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
