# ADR 0002: Frontend Authentication

- Status: Accepted
- Date: 2026-08-11

## Context

Shipflow uses short-lived bearer access tokens and opaque rotating refresh
tokens. The frontend must restore browser sessions without exposing the refresh
cookie or rendering stale protected content.

## Decisions

1. Keep the access token, authentication status, and current user only in the
   in-memory Zustand store. Do not use local storage, session storage, readable
   cookies, URLs, or logs for access or refresh tokens.
2. Restore a session at application startup by calling `/auth/refresh` with
   browser credentials. Protected routes render a controlled loading or retry
   state until restoration finishes.
3. Use one shared promise for startup restoration and one shared promise for
   concurrent API refreshes. Retry an authenticated request at most once.
4. Clear authentication, active organization state, and the query cache when
   refresh fails, logout completes, or logout-all completes.
5. Treat login, registration, and forgot-password as public-only routes. Keep
   reset and verification links accessible regardless of current session state.
6. Capture password reset and verification tokens once, remove them from the
   visible URL, and submit them only to their matching backend endpoints.
7. Handle OAuth callbacks by restoring the refresh-cookie session. Never return
   an access token in the OAuth callback URL.
8. Hide Google and GitHub controls unless their frontend feature flag is true.
   Provider credentials remain backend configuration and are optional.
9. Extend generated request types locally with password fields because the
   OpenAPI generator intentionally omits `writeOnly` properties from shared
   model output. The OpenAPI document remains authoritative for those fields.

## Consequences

Authentication state is lost on a full browser reload until refresh restoration
completes, which is intentional. Feature integrations must call the centralized
API client with `auth: true` and must not implement independent refresh or token
storage behavior.
