import { expect, test } from "@playwright/test"

const user = {
  avatarUrl: null,
  displayName: "Browser User",
  email: "browser@example.com",
  emailVerified: true,
  id: "69847052-dcab-4ca5-aec4-2be917302cca",
}

function organization(id: string, name: string, membershipId: string) {
  return {
    createdAt: "2026-08-12T00:00:00.000Z",
    currentUserCapabilities: ["organization:read", "membership:read"],
    currentUserRole: "MEMBER",
    id,
    memberCount: 1,
    membershipId,
    name,
    owner: user,
    ownerId: user.id,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    updatedAt: "2026-08-12T00:00:00.000Z",
  }
}

test("switching organizations replaces tenant-scoped team data", async ({
  page,
}) => {
  const organizationA = organization(
    "11111111-1111-4111-8111-111111111111",
    "Alpha Workspace",
    "22222222-2222-4222-8222-222222222222"
  )
  const organizationB = organization(
    "33333333-3333-4333-8333-333333333333",
    "Beta Workspace",
    "44444444-4444-4444-8444-444444444444"
  )

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
        items: [organizationA, organizationB],
        pagination: { limit: 100, page: 1, total: 2, totalPages: 1 },
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/organizations/*/members?**", (route) => {
    const isAlpha = route.request().url().includes(organizationA.id)
    const activeOrganization = isAlpha ? organizationA : organizationB
    return route.fulfill({
      body: JSON.stringify({
        items: [
          {
            createdAt: "2026-08-01T00:00:00.000Z",
            id: activeOrganization.membershipId,
            organizationId: activeOrganization.id,
            role: "MEMBER",
            updatedAt: "2026-08-01T00:00:00.000Z",
            user: {
              ...user,
              displayName: isAlpha ? "Alpha Member" : "Beta Member",
            },
          },
        ],
        pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
      }),
      contentType: "application/json",
      status: 200,
    })
  })

  await page.goto("/login")
  await page.getByLabel("Email address").fill(user.email)
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct horse battery staple")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByRole("link", { name: "Team" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Billing" })).toHaveCount(0)
  await page.evaluate(() => {
    window.history.pushState({}, "", "/billing")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  await expect(
    page.getByRole("heading", { name: "Access restricted" })
  ).toBeVisible()
  await page.evaluate(() => {
    window.history.pushState({}, "", "/team")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })

  await expect(page.getByText("Alpha Member")).toBeVisible()
  await page.getByRole("button", { name: "Switch organization" }).click()
  await page.getByText("Beta Workspace", { exact: true }).click()

  await expect(page.getByText("Beta Member")).toBeVisible()
  await expect(page.getByText("Alpha Member")).not.toBeVisible()
})
