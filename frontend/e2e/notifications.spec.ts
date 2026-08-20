import { expect, test } from "@playwright/test"

const organizationId = "11111111-1111-4111-8111-111111111111"
const user = {
  avatarUrl: null,
  displayName: "Browser User",
  email: "browser@example.com",
  emailVerified: true,
  id: "69847052-dcab-4ca5-aec4-2be917302cca",
}

test("opens a live notification and follows its permitted destination", async ({
  page,
}) => {
  let markedNotificationId: string | undefined
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
              "notification:read",
              "notification:manage",
            ],
            currentUserRole: "MEMBER",
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
  await page.route("**/api/v1/notifications/unread-count?**", (route) =>
    route.fulfill({
      body: JSON.stringify({ count: 1 }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/notifications?**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        items: [
          {
            actionPath: "/team",
            category: "ORGANIZATION",
            createdAt: "2026-08-13T10:00:00.000Z",
            expiresAt: "2026-09-13T10:00:00.000Z",
            id: "notification-1",
            message: "Sam joined Northstar Labs.",
            metadata: {},
            organizationId,
            readAt: null,
            title: "Member joined",
            type: "ORGANIZATION_INVITATION_ACCEPTED",
          },
        ],
        nextCursor: null,
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/notifications/*/read", (route) => {
    markedNotificationId = route.request().url().split("/").at(-2)
    return route.fulfill({
      body: JSON.stringify({ readAt: "2026-08-13T12:00:00.000Z" }),
      contentType: "application/json",
      status: 200,
    })
  })
  await page.route("**/api/v1/organizations/*/members?**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        items: [],
        pagination: { limit: 100, page: 1, total: 0, totalPages: 0 },
      }),
      contentType: "application/json",
      status: 200,
    })
  )
  await page.route("**/api/v1/organizations/*/invitations?**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        items: [],
        pagination: { limit: 100, page: 1, total: 0, totalPages: 0 },
      }),
      contentType: "application/json",
      status: 200,
    })
  )

  await page.goto("/login")
  await page.getByLabel("Email address").fill(user.email)
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct horse battery staple")
  await page.getByRole("button", { name: "Sign in" }).click()

  await page.getByRole("button", { name: "Notifications, 1 unread" }).click()
  await expect(page.getByText("Member joined", { exact: true })).toBeVisible()
  await page.getByText("Member joined", { exact: true }).click()

  await expect(page).toHaveURL(/\/team$/)
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible()
  expect(markedNotificationId).toBe("notification-1")
})
