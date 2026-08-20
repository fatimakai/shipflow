import { useQuery } from "@tanstack/react-query"

import type { OrganizationResponseDto } from "@/api/generated"
import { useOrganizationStore } from "@/stores/organization.store"

import { organizationApi } from "./organization-api"

export const organizationKeys = {
  all: ["organizations"] as const,
  detail: (organizationId: string) =>
    ["organization", organizationId, "detail"] as const,
  invitations: (organizationId: string) =>
    ["organization", organizationId, "invitations"] as const,
  list: ["organizations", "list"] as const,
  members: (organizationId: string) =>
    ["organization", organizationId, "members"] as const,
  scope: (organizationId: string) => ["organization", organizationId] as const,
}

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list,
    queryFn: () => organizationApi.list(),
  })
}

export function useActiveOrganization(): OrganizationResponseDto | null {
  const activeOrganizationId = useOrganizationStore(
    (state) => state.activeOrganizationId
  )
  const organizations = useOrganizations()

  return (
    organizations.data?.items.find(
      (organization) => organization.id === activeOrganizationId
    ) ?? null
  )
}

export function useOrganizationMembers(organizationId: string | null) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryKey: organizationId
      ? organizationKeys.members(organizationId)
      : ["organization", "none", "members"],
    queryFn: () => organizationApi.listMembers(organizationId!),
  })
}

export function useOrganizationInvitations(organizationId: string | null) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryKey: organizationId
      ? organizationKeys.invitations(organizationId)
      : ["organization", "none", "invitations"],
    queryFn: () => organizationApi.listInvitations(organizationId!),
  })
}
