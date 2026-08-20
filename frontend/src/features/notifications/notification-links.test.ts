import { describe, expect, it } from "vitest"

import type { OrganizationResponseDto } from "@/api/generated"

import { getSafeNotificationPath } from "./notification-links"

function organization(
  capabilities: OrganizationResponseDto["currentUserCapabilities"]
) {
  return { currentUserCapabilities: capabilities } as OrganizationResponseDto
}

describe("getSafeNotificationPath", () => {
  it("normalizes legacy internal destinations", () => {
    expect(
      getSafeNotificationPath(
        "/settings/billing?source=notification",
        organization(["billing:read"])
      )
    ).toBe("/billing?source=notification")
    expect(
      getSafeNotificationPath(
        "/settings/security",
        organization(["organization:read"])
      )
    ).toBe("/settings/password")
  })

  it("rejects external, unknown, and unauthorized destinations", () => {
    expect(
      getSafeNotificationPath(
        "https://example.com/phishing",
        organization(["billing:read"])
      )
    ).toBeNull()
    expect(
      getSafeNotificationPath("/admin", organization(["organization:read"]))
    ).toBeNull()
    expect(
      getSafeNotificationPath("/billing", organization(["organization:read"]))
    ).toBeNull()
  })
})
