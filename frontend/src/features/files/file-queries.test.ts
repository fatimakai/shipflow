import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it } from "vitest"

import { activateOrganization } from "@/features/organizations/organization-session"
import { useOrganizationStore } from "@/stores/organization.store"

import { fileKeys } from "./file-queries"

afterEach(() => useOrganizationStore.getState().clearActiveOrganization())

describe("file cache scope", () => {
  it("removes the previous organization's file data when switching", async () => {
    const queryClient = new QueryClient()
    useOrganizationStore.getState().setActiveOrganization("organization-a")
    queryClient.setQueryData(
      fileKeys.list("organization-a", 1),
      "organization-a-files"
    )
    queryClient.setQueryData(fileKeys.usage("organization-a"), "usage-a")
    queryClient.setQueryData(
      fileKeys.list("organization-b", 1),
      "organization-b-files"
    )

    await activateOrganization("organization-b", queryClient)

    expect(
      queryClient.getQueryData(fileKeys.list("organization-a", 1))
    ).toBeUndefined()
    expect(
      queryClient.getQueryData(fileKeys.usage("organization-a"))
    ).toBeUndefined()
    expect(queryClient.getQueryData(fileKeys.list("organization-b", 1))).toBe(
      "organization-b-files"
    )
  })
})
