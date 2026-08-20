import type { OrganizationResponseDto } from "@/api/generated"

export type OrganizationCapability =
  OrganizationResponseDto["currentUserCapabilities"][number]
export type OrganizationRole = OrganizationResponseDto["currentUserRole"]

export function hasOrganizationCapability(
  organization: OrganizationResponseDto | null,
  capability: OrganizationCapability
) {
  return organization?.currentUserCapabilities.includes(capability) ?? false
}

export function hasAnyOrganizationCapability(
  organization: OrganizationResponseDto | null,
  capabilities: readonly OrganizationCapability[]
) {
  return capabilities.some((capability) =>
    hasOrganizationCapability(organization, capability)
  )
}

// Display-only matrix. Backend capabilities remain authoritative for access.
export const roleCapabilities: Readonly<
  Record<OrganizationRole, readonly OrganizationCapability[]>
> = {
  OWNER: [
    "organization:read",
    "organization:update",
    "organization:delete",
    "organization:leave",
    "membership:read",
    "membership:change-role",
    "membership:remove",
    "invitation:read",
    "invitation:create",
    "invitation:resend",
    "invitation:revoke",
    "ownership:transfer",
    "billing:read",
    "billing:manage",
    "notification:read",
    "notification:manage",
    "file:read",
    "file:upload",
    "file:delete",
  ],
  ADMIN: [
    "organization:read",
    "organization:update",
    "organization:leave",
    "membership:read",
    "membership:change-role",
    "membership:remove",
    "invitation:read",
    "invitation:create",
    "invitation:resend",
    "invitation:revoke",
    "notification:read",
    "notification:manage",
    "file:read",
    "file:upload",
    "file:delete",
  ],
  MEMBER: [
    "organization:read",
    "organization:leave",
    "membership:read",
    "notification:read",
    "notification:manage",
    "file:read",
    "file:upload",
    "file:delete",
  ],
  VIEWER: [
    "organization:read",
    "organization:leave",
    "membership:read",
    "notification:read",
    "notification:manage",
    "file:read",
  ],
}

export function roleHasOrganizationCapability(
  role: OrganizationRole,
  capability: OrganizationCapability
) {
  return roleCapabilities[role].includes(capability)
}
