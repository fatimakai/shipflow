import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RolesPermissionsTab } from "./RolesPermissionsTab"

const deploymentProfile = vi.hoisted(() => ({ isPublicDemo: false }))

vi.mock("@/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/env")>()
  return {
    env: {
      ...actual.env,
      get isPublicDemo() {
        return deploymentProfile.isPublicDemo
      },
    },
  }
})

afterEach(() => {
  deploymentProfile.isPublicDemo = false
})

describe("RolesPermissionsTab", () => {
  it("matches the approved billing and notification role matrix", () => {
    render(<RolesPermissionsTab currentRole="ADMIN" />)

    const billingRow = screen.getByRole("row", { name: /Manage billing/ })
    const notificationsRow = screen.getByRole("row", {
      name: /Manage notifications/,
    })

    expect(within(billingRow).getAllByLabelText("Allowed")).toHaveLength(1)
    expect(within(notificationsRow).getAllByLabelText("Allowed")).toHaveLength(
      4
    )
    expect(screen.getByText("You")).toBeVisible()
    expect(screen.getByRole("row", { name: /View files/ })).toBeVisible()
  })

  it("omits unavailable file permissions in the public demo", () => {
    deploymentProfile.isPublicDemo = true
    render(<RolesPermissionsTab currentRole="OWNER" />)

    expect(screen.getByRole("row", { name: /Manage billing/ })).toBeVisible()
    expect(screen.queryByRole("row", { name: /View files/ })).toBeNull()
    expect(screen.queryByRole("row", { name: /Upload files/ })).toBeNull()
    expect(screen.queryByRole("row", { name: /Delete files/ })).toBeNull()
  })
})
