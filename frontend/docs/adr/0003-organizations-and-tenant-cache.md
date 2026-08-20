# ADR 0003: Organizations and Tenant Cache Isolation

Date: 2026-08-12

## Status

Accepted

## Context

NestShip users can belong to multiple organizations. The frontend must select an
active organization, present only actions allowed by the backend capability
contract, and prevent cached data from one organization appearing after a
tenant switch or membership loss.

## Decision

1. Keep the active organization ID in the existing in-memory Zustand store. Do
   not persist tenant selection in browser storage.
2. Initialize the active organization from the authenticated organization list
   and replace an invalid selection with the first current membership.
3. Prefix every tenant-scoped TanStack Query key with `organization` and the
   explicit organization ID.
4. Cancel and remove the previous organization's scoped queries before changing
   the active organization ID.
5. Clear active tenant state and invalidate the organization list after leave,
   deletion, invitation acceptance, or detected membership loss.
6. Use `currentUserCapabilities` from the organization response for frontend
   presentation. Backend guards remain authoritative for every operation.
7. Keep invitation acceptance outside the organization shell so users with no
   existing organization can join from an authenticated email link.

## Consequences

1. Refreshing the browser selects the first current organization instead of
   restoring a potentially stale tenant ID.
2. Tenant switches may show a short loading state while the new organization's
   data is fetched, but never reuse the previous tenant's data.
3. Feature queries added in later phases must use the shared organization query
   key convention and capability helpers.
