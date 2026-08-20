import type { OrganizationResponseDto } from "@/api/generated"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"

const LEGACY_PATHS: Record<string, string> = {
  "/settings/billing": "/billing",
  "/settings/security": "/settings/password",
}

export function getSafeNotificationPath(
  actionPath: string | null | undefined,
  organization: OrganizationResponseDto | null
) {
  if (!actionPath) return null

  let url: URL
  try {
    url = new URL(actionPath, "https://nestship.local")
  } catch {
    return null
  }

  if (url.origin !== "https://nestship.local") return null
  const path = LEGACY_PATHS[url.pathname] ?? url.pathname

  if (
    path === "/billing" &&
    !hasOrganizationCapability(organization, "billing:read")
  ) {
    return null
  }
  if (
    path === "/team" &&
    !hasOrganizationCapability(organization, "membership:read")
  ) {
    return null
  }
  if (
    path === "/settings/organization" &&
    !hasOrganizationCapability(organization, "organization:read")
  ) {
    return null
  }

  const allowed =
    path === "/billing" ||
    path === "/team" ||
    path === "/dashboard" ||
    path === "/notifications" ||
    path === "/settings/password" ||
    path === "/settings/profile" ||
    path === "/settings/organization"

  return allowed ? `${path}${url.search}${url.hash}` : null
}
