import { expect, test } from "@playwright/test"

const authentication = {
  accessToken: "browser-access-token",
  expiresIn: 900,
  tokenType: "Bearer",
  user: {
    avatarUrl: null,
    displayName: "Browser User",
    email: "browser@example.com",
    emailVerified: true,
    id: "69847052-dcab-4ca5-aec4-2be917302cca",
  },
}

const organization = {
  createdAt: "2026-08-12T00:00:00.000Z",
  currentUserCapabilities: ["organization:read", "membership:read"],
  currentUserRole: "MEMBER",
  id: "11111111-1111-4111-8111-111111111111",
  memberCount: 1,
  membershipId: "22222222-2222-4222-8222-222222222222",
  name: "Browser Workspace",
  owner: {
    avatarUrl: null,
    displayName: "Browser User",
    email: "browser@example.com",
    id: authentication.user.id,
  },
  ownerId: authentication.user.id,
  slug: "browser-workspace",
  updatedAt: "2026-08-12T00:00:00.000Z",
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      body: JSON.stringify({ message: "A refresh token is required" }),
      contentType: "application/json",
      status: 401,
    })
  )
  await page.route("**/api/v1/health/ready", (route) =>
    route.fulfill({
      body: JSON.stringify({
        checks: { configuration: "up", database: "up" },
        status: "ok",
        timestamp: "2026-08-11T00:00:00.000Z",
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/organizations?**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        items: [organization],
        pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
      }),
      contentType: "application/json",
      status: 200,
    })
  )
})

test("signs in and signs out", async ({ page }) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      body: JSON.stringify(authentication),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/auth/logout", (route) =>
    route.fulfill({
      body: JSON.stringify({ message: "Signed out" }),
      contentType: "application/json",
      status: 200,
    })
  )

  await page.goto("/login")
  await page.getByLabel("Email address").fill("browser@example.com")
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct horse battery staple")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText("API connected")).toBeVisible()

  await page.getByRole("button", { name: "Open account menu" }).click()
  await page.getByText("Log out", { exact: true }).click()

  await expect(page).toHaveURL(/\/login$/)
})

test("creates an account", async ({ page }) => {
  await page.unroute("**/api/v1/organizations?**")
  await page.route("**/api/v1/organizations?**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        items: [],
        pagination: { limit: 100, page: 1, total: 0, totalPages: 0 },
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/auth/register", (route) =>
    route.fulfill({
      body: JSON.stringify({
        ...authentication,
        user: { ...authentication.user, emailVerified: false },
      }),
      contentType: "application/json",
      status: 201,
    })
  )

  await page.goto("/register")
  await page.getByLabel("Name").fill("Browser User")
  await page.getByLabel("Email address").fill("browser@example.com")
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct horse battery staple")
  await page.getByLabel("Confirm password").fill("correct horse battery staple")
  await page.getByRole("button", { name: "Create account" }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText(/Verify browser@example.com/)).toBeVisible()
})
