import { Outlet } from "react-router-dom"

import type { OrganizationCapability } from "../organization-capabilities"
import { hasOrganizationCapability } from "../organization-capabilities"
import { useActiveOrganization } from "../organization-queries"
import { AccessRestricted } from "./AccessRestricted"

interface OrganizationCapabilityRouteProps {
  capability: OrganizationCapability
}

export function OrganizationCapabilityRoute({
  capability,
}: OrganizationCapabilityRouteProps) {
  const organization = useActiveOrganization()

  if (!hasOrganizationCapability(organization, capability)) {
    return <AccessRestricted />
  }

  return <Outlet />
}
