import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SecurityTab } from "./SecurityTab"

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

vi.mock("./ChangePasswordCard", () => ({
  ChangePasswordCard: () => <div>Change password card</div>,
}))
vi.mock("./TwoFactorCard", () => ({
  TwoFactorCard: () => <div>Two-factor authentication card</div>,
}))
vi.mock("./ActiveSessionsCard", () => ({
  ActiveSessionsCard: () => <div>Active sessions card</div>,
}))

afterEach(() => {
  deploymentProfile.isPublicDemo = false
})

describe("SecurityTab", () => {
  it("retains password reset in the standard profile", () => {
    render(<SecurityTab />)

    expect(screen.getByText("Change password card")).toBeVisible()
    expect(screen.getByText("Two-factor authentication card")).toBeVisible()
    expect(screen.getByText("Active sessions card")).toBeVisible()
  })

  it("hides password reset in the public demo", () => {
    deploymentProfile.isPublicDemo = true
    render(<SecurityTab />)

    expect(screen.queryByText("Change password card")).not.toBeInTheDocument()
    expect(screen.getByText("Two-factor authentication card")).toBeVisible()
    expect(screen.getByText("Active sessions card")).toBeVisible()
  })
})
