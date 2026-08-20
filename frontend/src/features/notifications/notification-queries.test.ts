import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it } from "vitest"

import { activateOrganization } from "@/features/organizations/organization-session"
import { useOrganizationStore } from "@/stores/organization.store"

import { notificationKeys } from "./notification-queries"

afterEach(() => useOrganizationStore.getState().clearActiveOrganization())

describe("notification cache scope", () => {
  it("removes the previous organization's notifications when switching", async () => {
    const queryClient = new QueryClient()
    useOrganizationStore.getState().setActiveOrganization("organization-a")
    queryClient.setQueryData(
      notificationKeys.feed("organization-a", false, 20),
      "organization-a-notifications"
    )
    queryClient.setQueryData(
      notificationKeys.unreadCount("organization-a"),
      "organization-a-count"
    )
    queryClient.setQueryData(
      notificationKeys.feed("organization-b", false, 20),
      "organization-b-notifications"
    )

    await activateOrganization("organization-b", queryClient)

    expect(
      queryClient.getQueryData(
        notificationKeys.feed("organization-a", false, 20)
      )
    ).toBeUndefined()
    expect(
      queryClient.getQueryData(notificationKeys.unreadCount("organization-a"))
    ).toBeUndefined()
    expect(
      queryClient.getQueryData(
        notificationKeys.feed("organization-b", false, 20)
      )
    ).toBe("organization-b-notifications")
  })
})
