import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RolesPermissionsTab } from "./RolesPermissionsTab"

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
  })
})
