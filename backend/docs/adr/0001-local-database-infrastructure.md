# ADR 0001: Local Database Infrastructure

- Status: Accepted
- Date: 2026-08-07

## Context

NestShip uses separate backend and frontend repositories. The backend needs a
repeatable local PostgreSQL service before Prisma and the initial database
schema can be introduced. Redis does not yet have an approved product or
operational responsibility.

## Decision

- Use PostgreSQL 18.4 through the official `postgres:18.4` Docker image.
- Keep `compose.yaml` in the backend repository while PostgreSQL is the only
  shared local service and is consumed exclusively by the backend.
- Persist PostgreSQL 18 data at `/var/lib/postgresql`, matching the official
  image's version-specific `PGDATA` layout.
- Bind the database port to `127.0.0.1` so the development database is not
  exposed on external network interfaces.
- Use a named Docker volume and enable PostgreSQL data checksums when the
  database cluster is initialized.
- Defer Redis until a concrete need exists for queues, distributed rate
  limiting, caching, or shared session state.

## Consequences

- Developers need Docker Desktop or another Compose-compatible Docker engine.
- The frontend never connects directly to PostgreSQL; it communicates with the
  NestJS API.
- Changing the PostgreSQL major version requires an explicit upgrade plan and
  cannot be performed by changing the image tag against the existing volume.
- The infrastructure can move to a dedicated repository if additional shared
  services or independently managed deployment resources justify that split.
- Redis must be introduced through a separate decision that defines its exact
  responsibility and failure behavior.

## References

- PostgreSQL versioning policy: https://www.postgresql.org/support/versioning/
- Official PostgreSQL image documentation: https://hub.docker.com/_/postgres
