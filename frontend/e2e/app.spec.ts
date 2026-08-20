import { expect, test } from "@playwright/test"

test("redirects an unauthenticated visitor to sign in", async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      body: JSON.stringify({ message: "A refresh token is required" }),
      contentType: "application/json",
      status: 401,
    })
  )

  await page.goto("/dashboard")

  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible()
})
