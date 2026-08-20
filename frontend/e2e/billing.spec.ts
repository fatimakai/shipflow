import { expect, test } from "@playwright/test"

const organizationId = "11111111-1111-4111-8111-111111111111"
const user = {
  avatarUrl: null,
  displayName: "Billing Owner",
  email: "billing-owner@example.com",
  emailVerified: true,
  id: "69847052-dcab-4ca5-aec4-2be917302cca",
}

const freePlan = {
  annualPriceCents: 0,
  code: "FREE",
  currency: "usd",
  description: "Core workspace features",
  features: ["Up to 3 members", "1 GB storage"],
  monthlyPriceCents: 0,
  name: "Free",
}

const proPlan = {
  annualPriceCents: 29000,
  code: "PRO",
  currency: "usd",
  description: "For growing teams",
  features: ["Unlimited members", "100 GB storage"],
  monthlyPriceCents: 2900,
  name: "Pro",
}

test("completes the hosted billing flow on mobile", async ({ page }) => {
  let authenticated = false
  let checkoutCreated = false
  let portalCreated = false

  await page.setViewportSize({ height: 844, width: 390 })
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      body: JSON.stringify(
        authenticated
          ? {
              accessToken: "browser-access-token",
              expiresIn: 900,
              tokenType: "Bearer",
              user,
            }
          : { message: "A refresh token is required" }
      ),
      contentType: "application/json",
      status: authenticated ? 200 : 401,
    })
  )
  await page.route("**/api/v1/auth/login", (route) => {
    authenticated = true
    return route.fulfill({
      body: JSON.stringify({
        accessToken: "browser-access-token",
        expiresIn: 900,
        tokenType: "Bearer",
        user,
      }),
      contentType: "application/json",
      status: 200,
    })
  })
  await page.route("**/api/v1/organizations?**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        items: [
          {
            createdAt: "2026-08-13T00:00:00.000Z",
            currentUserCapabilities: [
              "organization:read",
              "membership:read",
              "billing:read",
              "billing:manage",
            ],
            currentUserRole: "OWNER",
            id: organizationId,
            memberCount: 1,
            membershipId: "22222222-2222-4222-8222-222222222222",
            name: "Northstar Labs",
            owner: user,
            ownerId: user.id,
            slug: "northstar-labs",
            updatedAt: "2026-08-13T00:00:00.000Z",
          },
        ],
        pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/billing/plans", (route) =>
    route.fulfill({
      body: JSON.stringify({ items: [freePlan, proPlan] }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route(
    `**/api/v1/organizations/${organizationId}/billing`,
    (route) =>
      route.fulfill({
        body: JSON.stringify(
          checkoutCreated
            ? {
                cancelAtPeriodEnd: false,
                currentPeriodEnd: "2026-09-13T00:00:00.000Z",
                hasPaidAccess: true,
                interval: "ANNUAL",
                plan: proPlan,
                subscriptionStatus: "ACTIVE",
              }
            : {
                cancelAtPeriodEnd: false,
                hasPaidAccess: false,
                plan: freePlan,
              }
        ),
        contentType: "application/json",
        status: 200,
      })
  )
  await page.route(
    `**/api/v1/organizations/${organizationId}/billing/checkout-session`,
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({ interval: "ANNUAL" })
      checkoutCreated = true
      return route.fulfill({
        body: JSON.stringify({
          sessionId: "cs_browser_123",
          url: "http://localhost:5173/billing?checkout=success&session_id=cs_browser_123",
        }),
        contentType: "application/json",
        status: 201,
      })
    }
  )
  await page.route(
    `**/api/v1/organizations/${organizationId}/billing/portal-session`,
    (route) => {
      portalCreated = true
      return route.fulfill({
        body: JSON.stringify({ url: "http://localhost:5173/billing" }),
        contentType: "application/json",
        status: 201,
      })
    }
  )

  await page.goto("/billing")
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel("Email address").fill(user.email)
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct horse battery staple")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Annual" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await page.getByRole("button", { name: "Choose Pro" }).click()

  await expect(page.getByText("Subscription confirmed")).toBeVisible()
  await expect(page).toHaveURL(/\/billing$/)
  await expect(
    page.getByText("Backend-confirmed workspace access")
  ).toBeVisible()

  await Promise.all([
    page.waitForEvent("framenavigated"),
    page.getByRole("button", { name: "Manage billing" }).click(),
  ])
  await expect.poll(() => portalCreated).toBe(true)
  await expect(page).toHaveURL(/\/billing$/)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    )
    .toBe(true)
})
