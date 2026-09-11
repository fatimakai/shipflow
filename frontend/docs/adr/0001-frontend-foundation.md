# ADR 0001: Frontend Foundation

- Status: Accepted
- Date: 2026-08-11

## Context

ShipFlow uses separate frontend and backend repositories. The frontend needs a
small, typed foundation that follows the backend OpenAPI contract and preserves
the existing React/Vite UI.

## Decisions

1. Use npm 11 with Node.js 24 for the frontend repository.
2. Use native `fetch` behind one API client rather than introducing a generated
   runtime client.
3. Use TanStack Query for server-owned state and caching.
4. Use Zustand only for the in-memory access token and active organization ID.
   Do not persist either store during the foundation phase.
5. Use React Hook Form and Zod for forms and client-side validation.
6. Generate TypeScript types from the backend OpenAPI document with
   `@hey-api/openapi-ts`. Commit the generated output and regenerate it whenever
   the backend contract changes before frontend integration work is merged.
7. Use Vitest, React Testing Library, and MSW for unit/integration tests and
   Playwright for browser tests.
8. Support current Chrome, Edge, Firefox, and Safari releases and responsive
   layouts from 360 CSS pixels upward. Browser expansion remains a release
   validation concern.
9. Keep access tokens in memory. Use explicit credentialed requests only for
   backend refresh/logout cookie flows. Standard API errors and request IDs are
   preserved by the API client.

## Deferred Optional Decisions

Production deployment providers, analytics, consent tooling, centralized error
monitoring, preview deployments, visual regression services, and source-map
publication are deferred until production hardening or CI/CD planning. They are
not required for the repository foundation.

## Consequences

The frontend can develop against generated contract types while retaining a
small runtime network layer. Feature phases must use query keys containing the
active organization ID for tenant-scoped server data and must not move
server-owned state into Zustand.
