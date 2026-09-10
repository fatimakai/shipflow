# Provider-Independent Production Baseline

## Supported Topology

The current baseline supports one backend instance connected to PostgreSQL and
private S3 storage. In-memory rate limits are process-local. Do not scale the
backend horizontally until a shared rate-limit store and its failure behavior
are approved.

Set `HTTP_TRUST_PROXY_HOPS=0` when clients connect directly. When a reverse proxy
or load balancer is introduced, count the fixed trusted hops from the backend to
the client-facing edge and set that exact integer. Never enable unrestricted
proxy trust.

## Container Build

Build the non-root runtime image:

```bash
docker build --target runtime -t shipflow-backend:local .
```

Build the migration image from the same source and lockfile:

```bash
docker build --target migrate -t shipflow-backend-migrate:local .
```

Run the runtime filesystem read-only and supply secrets through the deployment
environment. The application binds to `0.0.0.0:$PORT`; `/api/v1/health/live`
checks the process and `/api/v1/health/ready` checks PostgreSQL.

## Deployment Sequence

1. Build immutable runtime and migration images from the same commit.
2. Create and verify an encrypted custom-format database backup.
3. Run the migration image once with the production environment.
4. Deploy exactly one backend instance and wait for readiness.
5. Run authentication, billing webhook, email, and file-storage smoke checks.
6. Observe JSON logs and slow-query warnings before declaring success.

Database migrations are forward-only. Prefer expand-and-contract changes that
remain compatible with the previous application release. If deployment fails,
roll back the application image first. Restore a database backup only when the
migration is proven destructive or incompatible and an incident owner approves
the restore.

## Backup And Restore

Install PostgreSQL client tools matching the database major version. Create a
custom-format backup without exposing credentials in process arguments:

```bash
pnpm db:backup
pnpm db:backup backups/pre-release.dump
```

Test restoration against a separate empty recovery database:

```bash
DATABASE_URL="postgresql://.../shipflow_recovery" pnpm db:restore backups/pre-release.dump --confirm-restore
pnpm prisma:migrate:deploy
```

Verify row counts, authentication, tenant isolation, and representative files
before considering a restore successful. Production schedules, encryption,
off-site retention, and recovery objectives remain deployment decisions.

## Incident Procedure

1. Record the start time, affected environment, release identifier, and request IDs.
2. Stop rollout and preserve logs; do not log or paste credentials or raw payloads.
3. Use liveness and readiness to distinguish process failure from database failure.
4. Roll back the application image when schema compatibility permits.
5. Rotate exposed credentials and invalidate affected sessions when compromise is suspected.
6. Validate recovery with smoke tests and record the cause and corrective action.

## Acceptance Checklist

- `pnpm install --frozen-lockfile` succeeds from a clean checkout.
- Format, lint, unit, e2e, Prisma validation, migration, audit, and build checks pass.
- The runtime image starts as a non-root user and its health check passes.
- Production responses include security headers and never expose `X-Powered-By`.
- Oversized and timed-out requests fail with bounded responses.
- Logs are valid JSON and redact credentials, cookies, tokens, signatures, and email fields.
- Slow-query logs contain duration and target only, never SQL parameters.
- Readiness fails when PostgreSQL is unavailable.
- A backup restores successfully into an isolated recovery database.
- Tenant, authentication, webhook, billing, and file regressions pass.

## Remaining Provider Decisions

Before commercial production, select error monitoring and alert delivery,
centralized log retention, uptime monitoring, the deployment platform, managed
PostgreSQL, and automated encrypted backup storage.
