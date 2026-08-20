# ADR 0006: Role-Based Access Control

- Status: Accepted
- Date: 2026-08-08

## Context

Phase 7 established organizations as the tenant boundary with a narrow set of
role checks. Later billing, notification, and file modules need one stable
authorization model so feature services do not invent contradictory Owner,
Admin, Member, and Viewer behavior.

## Decision

- Represent authorization as named capabilities rather than role comparisons
  inside feature modules.
- Keep the role-to-capability matrix in the central `AuthorizationService`.
  Return a defensive copy of effective capabilities in organization responses
  so clients can adapt their interface without becoming an authorization
  boundary.
- Resolve organization membership from the authenticated user ID and explicit
  route organization ID in `OrganizationAuthorizationGuard`. Attach the resolved
  organization context to the request so controllers and services do not repeat
  tenant lookups.
- Declare required capabilities on controller methods with
  `RequireOrganizationCapabilities`. Keep a reusable
  `RequireOrganizationMembership` decorator for routes that need membership but
  no narrower capability.
- Return `404 Not Found` before capability evaluation when a tenant is missing,
  deleted, or inaccessible. Return `403 Forbidden` when membership exists but a
  required capability is absent.
- Keep resource-sensitive hierarchy rules in the central authorization service.
  Owners may manage every non-owner role. Admins may manage only Member and
  Viewer roles. Membership self-removal uses the leave endpoint, and Owners must
  transfer ownership before leaving.
- Use the following approved baseline matrix:

| Capability group            | Owner          | Admin                  | Member | Viewer |
| --------------------------- | -------------- | ---------------------- | ------ | ------ |
| Organization read           | Yes            | Yes                    | Yes    | Yes    |
| Organization update         | Yes            | Yes                    | No     | No     |
| Organization delete         | Yes            | No                     | No     | No     |
| Organization leave          | After transfer | Yes                    | Yes    | Yes    |
| Membership read             | Yes            | Yes                    | Yes    | Yes    |
| Membership role/remove      | Yes            | Member and Viewer only | No     | No     |
| Invitation lifecycle        | Yes            | Member and Viewer only | No     | No     |
| Ownership transfer          | Yes            | No                     | No     | No     |
| Billing read/manage         | Yes            | No                     | No     | No     |
| Own notification management | Yes            | Yes                    | Yes    | Yes    |
| File read/download          | Yes            | Yes                    | Yes    | Yes    |
| File upload/delete          | Yes            | Yes                    | Yes    | No     |

- Treat file deletion as a baseline module capability. Phase 13 must still add
  resource-sensitive checks such as object ownership and organization scope.
- Require every new organization-scoped module to add capability keys, update
  the matrix, use the guard/decorators, and extend exhaustive matrix tests.

## Consequences

- Organization feature code no longer contains authorization role comparisons;
  role-specific logic is centralized and testable.
- Frontends may use `currentUserCapabilities` for navigation and control states,
  but every request remains subject to backend guards and resource checks.
- All role/capability combinations have table-driven allow/deny coverage.
- Billing, notifications, and files can adopt the same model without changing
  the organization tenant boundary.
- Capability changes are API contract changes and require coordinated release
  notes once frontend consumption begins.
