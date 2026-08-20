import type { QueryClient } from "@tanstack/react-query"

import { queryClient } from "@/api/query-client"
import type { OrganizationListResponseDto } from "@/api/generated"
import { isApiError } from "@/api/api-error"
import { useOrganizationStore } from "@/stores/organization.store"

import { organizationKeys } from "./organization-queries"
import { organizationApi } from "./organization-api"

export async function activateOrganization(
  organizationId: string,
  client: QueryClient = queryClient
) {
  const store = useOrganizationStore.getState()
  const previousOrganizationId = store.activeOrganizationId

  if (previousOrganizationId === organizationId) {
    return
  }

  if (previousOrganizationId) {
    await client.cancelQueries({
      queryKey: organizationKeys.scope(previousOrganizationId),
    })
    client.removeQueries({
      queryKey: organizationKeys.scope(previousOrganizationId),
    })
  }

  store.setActiveOrganization(organizationId)
}

export async function clearActiveOrganizationData(
  client: QueryClient = queryClient
) {
  const store = useOrganizationStore.getState()
  const organizationId = store.activeOrganizationId

  if (organizationId) {
    await client.cancelQueries({
      queryKey: organizationKeys.scope(organizationId),
    })
    client.removeQueries({ queryKey: organizationKeys.scope(organizationId) })
  }

  store.clearActiveOrganization()
}

export async function recoverOrganizationAuthorization(
  error: unknown,
  organizationId: string,
  client: QueryClient = queryClient
) {
  if (
    !isApiError(error) ||
    (error.statusCode !== 403 && error.statusCode !== 404)
  ) {
    return false
  }

  try {
    const organizations = await organizationApi.list()
    client.setQueryData<OrganizationListResponseDto>(
      organizationKeys.list,
      organizations
    )
    const membershipStillExists = organizations.items.some(
      (organization) => organization.id === organizationId
    )

    if (
      !membershipStillExists &&
      useOrganizationStore.getState().activeOrganizationId === organizationId
    ) {
      await clearActiveOrganizationData(client)
    }

    return true
  } catch {
    return false
  }
}
