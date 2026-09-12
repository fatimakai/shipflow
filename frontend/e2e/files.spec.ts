import { expect, test } from "@playwright/test"

const organizationId = "11111111-1111-4111-8111-111111111111"
const user = {
  avatarUrl: null,
  displayName: "Browser User",
  email: "browser@example.com",
  emailVerified: true,
  id: "69847052-dcab-4ca5-aec4-2be917302cca",
}

test("uploads, downloads, and deletes a workspace file on mobile", async ({
  page,
}) => {
  let authenticated = false
  let completed = false
  let deleted = false
  let reservationBody: Record<string, unknown> | null = null

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
            createdAt: "2026-08-01T00:00:00.000Z",
            currentUserCapabilities: [
              "organization:read",
              "file:read",
              "file:upload",
              "file:delete",
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

  const file = {
    createdAt: "2026-08-13T10:00:00.000Z",
    deletedAt: null,
    id: "upload-file",
    malwareStatus: "NOT_REQUIRED",
    mimeType: "text/plain",
    organizationId,
    originalName: "launch-notes.txt",
    sizeBytes: 13,
    status: "READY",
    storageProvider: "LOCAL",
    uploadedAt: "2026-08-13T10:01:00.000Z",
    uploadedBy: { displayName: user.displayName, id: user.id },
  }

  await page.route(
    `**/api/v1/organizations/${organizationId}/files/usage`,
    (route) =>
      route.fulfill({
        body: JSON.stringify({
          maxBytes: 100 * 1024 * 1024,
          maxFiles: 100,
          usedBytes: completed && !deleted ? file.sizeBytes : 0,
          usedFiles: completed && !deleted ? 1 : 0,
        }),
        contentType: "application/json",
        status: 200,
      })
  )
  await page.route(
    `**/api/v1/organizations/${organizationId}/files?**`,
    (route) => {
      const items = completed && !deleted ? [file] : []
      return route.fulfill({
        body: JSON.stringify({
          items,
          pagination: {
            limit: 20,
            page: 1,
            total: items.length,
            totalPages: items.length ? 1 : 0,
          },
        }),
        contentType: "application/json",
        status: 200,
      })
    }
  )
  await page.route(
    `**/api/v1/organizations/${organizationId}/files/uploads`,
    async (route) => {
      reservationBody = route.request().postDataJSON()
      return route.fulfill({
        body: JSON.stringify({
          file: { ...file, status: "PENDING", uploadedAt: null },
          upload: {
            expiresAt: "2027-08-13T00:00:00.000Z",
            fields: { token: "signed-upload" },
            headers: {},
            fileField: "file",
            method: "POST",
            url: "/api/v1/file-content/upload-file?token=signed-upload",
          },
        }),
        contentType: "application/json",
        status: 201,
      })
    }
  )
  await page.route("**/api/v1/file-content/upload-file?**", (route) =>
    route.fulfill({ status: 204 })
  )
  await page.route(
    `**/api/v1/organizations/${organizationId}/files/upload-file/complete`,
    (route) => {
      completed = true
      return route.fulfill({
        body: JSON.stringify(file),
        contentType: "application/json",
        status: 200,
      })
    }
  )
  await page.route(
    `**/api/v1/organizations/${organizationId}/files/upload-file/download-url`,
    (route) =>
      route.fulfill({
        body: JSON.stringify({
          expiresAt: "2027-08-13T00:00:00.000Z",
          method: "GET",
          url: "/api/v1/file-content/download-file?token=signed-download",
        }),
        contentType: "application/json",
        status: 200,
      })
  )
  await page.route("**/api/v1/file-content/download-file?**", (route) =>
    route.fulfill({
      body: "Release alpha",
      contentType: "text/plain",
      headers: {
        "content-disposition": 'attachment; filename="launch-notes.txt"',
      },
      status: 200,
    })
  )
  await page.route(
    `**/api/v1/organizations/${organizationId}/files/upload-file`,
    (route) => {
      deleted = true
      return route.fulfill({
        body: JSON.stringify({
          ...file,
          deletedAt: "2026-08-13T12:00:00.000Z",
          status: "DELETED",
        }),
        contentType: "application/json",
        status: 200,
      })
    }
  )

  await page.goto("/files")
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel("Email address").fill(user.email)
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct horse battery staple")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(
    page.getByRole("heading", { name: "Files", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Upload file" }).click()
  await page.getByLabel("Select file to upload").setInputFiles({
    buffer: Buffer.from("Release alpha"),
    mimeType: "text/plain",
    name: "launch-notes.txt",
  })

  await expect(page.getByText(/Upload complete/)).toBeVisible()
  expect(reservationBody).toMatchObject({
    fileName: "launch-notes.txt",
    mimeType: "text/plain",
    sizeBytes: 13,
  })
  expect(reservationBody?.checksumSha256).toMatch(/^[a-f0-9]{64}$/)
  await page.getByRole("button", { name: "Done" }).click()
  await expect(page.getByText("launch-notes.txt")).toBeVisible()

  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download launch-notes.txt" }).click()
  await expect((await download).suggestedFilename()).toBe("launch-notes.txt")

  await page.getByRole("button", { name: "Delete launch-notes.txt" }).click()
  await page.getByRole("button", { name: "Delete file" }).click()
  await expect(page.getByText("No files found")).toBeVisible()
  expect(deleted).toBe(true)

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
