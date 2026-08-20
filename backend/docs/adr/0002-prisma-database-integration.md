# ADR 0002: Prisma Database Integration

- Status: Accepted
- Date: 2026-08-07

## Context

The NestJS application needs a reusable PostgreSQL access boundary before the
initial domain schema is designed. The repository currently compiles as
CommonJS, and database availability must be represented by the readiness
endpoint.

## Decision

- Use Prisma ORM 7 with `@prisma/adapter-pg` and the `pg` driver.
- Configure Prisma CLI database access in `prisma.config.ts` and validate the
  runtime `DATABASE_URL`, pool size, and connection timeout through Joi.
- Generate Prisma Client as CommonJS source under `src/generated/prisma` and
  commit it so clean checkouts can build without generation side effects.
- Keep one global `PrismaService` for the NestJS application lifetime.
- Connect during module initialization and disconnect during graceful module
  destruction.
- Use a real database query for readiness and return HTTP 503 when an
  established application's database connection becomes unavailable.
- Keep the Prisma schema model-free until Phase 4 database rules and models are
  approved.

## Consequences

- PostgreSQL must be available when the application starts and when e2e tests
  run.
- Schema changes require formatting, validation, client generation, and a
  committed migration.
- Generated Prisma source changes are reviewed alongside schema and Prisma
  version changes but are excluded from linting and formatting.
- Jest runs with Node's VM modules flag because Prisma 7 loads its WASM query
  compiler dynamically.

## References

- Prisma NestJS guide: https://www.prisma.io/docs/guides/frameworks/nestjs
- Prisma PostgreSQL connector:
  https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql
