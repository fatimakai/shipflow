import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it } from "vitest"
import { http, HttpResponse } from "msw"

import { ApiError } from "@/api/api-error"
import type { OrganizationListResponseDto } from "@/api/generated"
import { useOrganizationStore } from "@/stores/organization.store"
import { server } from "@/test/mocks/server"

import { organizationKeys } from "./organization-queries"
import {
  activateOrganization,
  clearActiveOrganizationData,
  recoverOrganizationAuthorization,
} from "./organization-session"

afterEach(() => useOrganizationStore.getState().clearActiveOrganization())

describe("organization session", () => {
  it("removes the previous tenant cache before switching organizations", async () => {
    const queryClient = new QueryClient()
    useOrganizationStore.getState().setActiveOrganization("organization-a")
    queryClient.setQueryData(
      organizationKeys.members("organization-a"),
      "tenant-a-data"
    )
    queryClient.setQueryData(
      organizationKeys.members("organization-b"),
      "tenant-b-data"
    )
    queryClient.setQueryData(organizationKeys.list, "organization-list")

    await activateOrganization("organization-b", queryClient)

    expect(
      queryClient.getQueryData(organizationKeys.members("organization-a"))
    ).toBeUndefined()
    expect(
      queryClient.getQueryData(organizationKeys.members("organization-b"))
    ).toBe("tenant-b-data")
    expect(queryClient.getQueryData(organizationKeys.list)).toBe(
      "organization-list"
    )
    expect(useOrganizationStore.getState().activeOrganizationId).toBe(
      "organization-b"
    )
  })

  it("clears active tenant data after membership loss", async () => {
    const queryClient = new QueryClient()
    useOrganizationStore.getState().setActiveOrganization("organization-a")
    queryClient.setQueryData(
      organizationKeys.invitations("organization-a"),
      "private-data"
    )

    await clearActiveOrganizationData(queryClient)

    expect(
      queryClient.getQueryData(organizationKeys.invitations("organization-a"))
    ).toBeUndefined()
    expect(useOrganizationStore.getState().activeOrganizationId).toBeNull()
  })

  it("refreshes capabilities after a forbidden tenant response", async () => {
    const queryClient = new QueryClient()
    const organization = {
      createdAt: "2026-08-12T00:00:00.000Z",
      currentUserCapabilities: ["organization:read", "membership:read"],
      currentUserRole: "MEMBER",
      id: "organization-a",
      memberCount: 1,
      membershipId: "membership-a",
      name: "Northstar Labs",
      owner: {
        avatarUrl: null,
        displayName: null,
        email: "owner@example.com",
        id: "owner-a",
      },
      ownerId: "owner-a",
      slug: "northstar-labs",
      updatedAt: "2026-08-12T00:00:00.000Z",
    } as const
    server.use(
      http.get("http://localhost:3000/api/v1/organizations", () =>
        HttpResponse.json({
          items: [organization],
          pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
        })
      )
    )
    useOrganizationStore.getState().setActiveOrganization("organization-a")

    await recoverOrganizationAuthorization(
      new ApiError("Forbidden", { statusCode: 403 }),
      "organization-a",
      queryClient
    )

    expect(useOrganizationStore.getState().activeOrganizationId).toBe(
      "organization-a"
    )
    expect(
      queryClient.getQueryData<OrganizationListResponseDto>(
        organizationKeys.list
      )?.items[0].currentUserCapabilities
    ).toEqual(["organization:read", "membership:read"])
  })
})
