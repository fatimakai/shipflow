import { useQueryClient } from "@tanstack/react-query"
import { useEffect, type PropsWithChildren } from "react"

import { SessionStateScreen } from "@/features/auth/components/SessionStateScreen"
import { useOrganizationStore } from "@/stores/organization.store"

import { getOrganizationErrorMessage } from "../organization-errors"
import { useOrganizations } from "../organization-queries"
import { activateOrganization } from "../organization-session"
import { OrganizationOnboarding } from "./OrganizationOnboarding"

export function OrganizationBootstrap({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const activeOrganizationId = useOrganizationStore(
    (state) => state.activeOrganizationId
  )
  const organizations = useOrganizations()
  const activeOrganizationIsValid =
    organizations.data?.items.some(
      (organization) => organization.id === activeOrganizationId
    ) ?? false

  useEffect(() => {
    const firstOrganization = organizations.data?.items[0]

    if (!activeOrganizationIsValid && firstOrganization) {
      void activateOrganization(firstOrganization.id, queryClient)
    }
  }, [activeOrganizationIsValid, organizations.data, queryClient])

  if (organizations.isPending) {
    return <SessionStateScreen message="Loading your organizations..." />
  }

  if (organizations.isError) {
    return (
      <SessionStateScreen
        error={getOrganizationErrorMessage(
          organizations.error,
          "Unable to load your organizations."
        )}
        onRetry={() => void organizations.refetch()}
      />
    )
  }

  if (organizations.data.items.length === 0) {
    return <OrganizationOnboarding />
  }

  if (!activeOrganizationIsValid) {
    return <SessionStateScreen message="Opening your organization..." />
  }

  return children
}
