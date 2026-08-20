# ADR 0005: Organizations and Multi-Tenancy

- Status: Accepted
- Date: 2026-08-07

## Context

NestShip needs an explicit tenant boundary before billing, notifications, files,
and other organization-owned resources are added. Users may belong to multiple
organizations, while every tenant-scoped operation must reject valid resource
identifiers from organizations the caller cannot access.

## Decision

- Put the organization ID in every tenant-scoped route. Resolve the current
  user's membership by both user ID and organization ID before loading or
  mutating nested resources.
- Return `404 Not Found` when the organization is missing, soft-deleted, or not
  visible to the caller. This avoids revealing another tenant's existence.
- Require verified email addresses for organization creation and invitation
  acceptance. Users may still authenticate before verification.
- Create an organization and its single `OWNER` membership in one transaction.
  Generate a lowercase normalized slug from the organization name and append
  numeric collision suffixes. Keep the slug stable when the display name is
  updated.
- Use page-based collection pagination with a default limit of 20 and a maximum
  limit of 100. Order collections deterministically with an ID tie-breaker.
- Issue seven-day organization invitations using 32-byte opaque tokens. Store
  only SHA-256 token hashes, normalize invited email addresses, allow only one
  pending invitation per organization and email, and rotate the token when an
  invitation is resent.
- Bind invitation acceptance to an authenticated user with the same normalized
  email address. Invitations are single-use, revocable, and lazily transitioned
  to `EXPIRED` when accessed after expiry.
- During Phase 7, let Owners manage all non-owner memberships and invitations.
  Let Admins manage only Member and Viewer memberships and invitations. Reserve
  final capability-based authorization for Phase 8.
- Reserve ownership transfer and organization deletion for the Owner. Transfer
  ownership transactionally, promote the target membership to Owner, and move
  the former Owner to Admin. Require the Owner to transfer ownership before
  leaving.
- Soft-delete organizations, revoke their pending invitations, and make the
  organization immediately inaccessible. Restore and purge workflows remain
  deferred.
- Keep invitation delivery behind a replaceable interface. ADR 0007 consolidates
  invitation and authentication delivery behind the shared transactional email
  implementation completed in Phase 9.

## Consequences

- Every later organization-owned module must resolve the same organization
  context before accessing a nested resource.
- Frontend-hidden controls remain a usability feature only; the backend always
  enforces membership and Phase 7's interim management hierarchy.
- Role comparisons in Phase 7 are intentionally narrow and will move behind the
  capability service and guards introduced in Phase 8.
- Organization renaming does not invalidate bookmarks or integrations because
  the generated slug is immutable.
- Soft-deleted organization records and memberships remain available for future
  audit, restore, or purge policy decisions but cannot be used through supported
  APIs.
