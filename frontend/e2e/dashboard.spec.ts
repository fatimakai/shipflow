import { expect, test, type Page } from "@playwright/test"

const organizationId = "11111111-1111-4111-8111-111111111111"
const user = {
  avatarUrl: null,
  displayName: "Browser User",
  email: "browser@example.com",
  emailVerified: true,
  id: "69847052-dcab-4ca5-aec4-2be917302cca",
}

async function mockDashboard(page: Page) {
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      body: JSON.stringify({ message: "A refresh token is required" }),
      contentType: "application/json",
      status: 401,
    })
  )
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      body: JSON.stringify({
        accessToken: "browser-access-token",
        expiresIn: 900,
        tokenType: "Bearer",
        user,
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/organizations?**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        items: [
          {
            createdAt: "2026-08-01T00:00:00.000Z",
            currentUserCapabilities: [
              "organization:read",
              "membership:read",
              "billing:read",
              "notification:read",
              "file:read",
            ],
            currentUserRole: "OWNER",
            id: organizationId,
            memberCount: 1,
            membershipId: "22222222-2222-4222-8222-222222222222",
            name: "Northstar Labs",
            owner: user,
            ownerId: user.id,
            slug: "northstar-labs",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
        ],
        pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/organizations/*/members?**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        items: [
          {
            createdAt: "2026-08-10T00:00:00.000Z",
            id: "22222222-2222-4222-8222-222222222222",
            organizationId,
            role: "OWNER",
            updatedAt: "2026-08-10T00:00:00.000Z",
            user,
          },
        ],
        pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/organizations/*/files/usage", (route) =>
    route.fulfill({
      body: JSON.stringify({
        maxBytes: 10485760,
        maxFiles: 100,
        usedBytes: 1048576,
        usedFiles: 4,
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/notifications/unread-count?**", (route) =>
    route.fulfill({
      body: JSON.stringify({ count: 3 }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/organizations/*/billing", (route) =>
    route.fulfill({
      body: JSON.stringify({
        cancelAtPeriodEnd: false,
        hasPaidAccess: true,
        plan: {
          annualPriceCents: 9900,
          code: "PRO",
          currency: "USD",
          description: "For growing teams",
          features: ["More storage"],
          monthlyPriceCents: 990,
          name: "Pro",
        },
        subscriptionStatus: "ACTIVE",
      }),
      contentType: "application/json",
      status: 200,
    })
  )
}

for (const viewport of [
  { height: 900, label: "desktop", width: 1440 },
  { height: 844, label: "mobile", width: 390 },
]) {
  test(`renders the real dashboard without page overflow on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    })
    await mockDashboard(page)

    await page.goto("/login")
    await page.getByLabel("Email address").fill(user.email)
    await page
      .getByLabel("Password", { exact: true })
      .fill("correct horse battery staple")
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(
      page.getByRole("heading", { name: "Northstar Labs" })
    ).toBeVisible()
    await expect(page.getByText("1.0 MB", { exact: true })).toBeVisible()
    await expect(page.getByText("Pro", { exact: true })).toBeVisible()
    await expect(page.getByText("Total Revenue")).toHaveCount(0)
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
}
