# ADR 0010: Organization File Storage

## Status

Accepted on 2026-08-10. Amended on 2026-09-12 for R2 and ClamAV.

## Decision

- Use private filesystem storage under `.data/files` in development and tests.
- Use a private Cloudflare R2 bucket in production through its S3-compatible API.
- Require `FILE_STORAGE_PROVIDER=s3` and ClamAV malware scanning in production.
- Upload directly to a signed provider target. Local targets are HMAC-signed API
  URLs; R2 targets are presigned `PUT` URLs with signed object metadata.
- Limit files to 25 MiB and require an exact size and SHA-256 checksum before
  issuing a ten-minute upload target.
- Accept PDF, JPEG, PNG, WebP, UTF-8 TXT/CSV/JSON, DOCX, XLSX, and PPTX. Validate
  extension, declared MIME type, byte signature or container structure, size,
  and checksum before a file becomes available.
- Keep downloads private behind five-minute signed URLs. Never persist signed
  URLs or expose permanent provider URLs.
- Give Free organizations 100 MiB and 100 files; give Pro organizations 10 GiB
  and 10,000 files. Count active reservations, scanning files, ready files, and
  recoverable deleted files. Allow five active reservations per user and twenty
  per organization.
- Soft-delete uploaded files for 30 days, then delete the object and retain an
  audit-only tombstone for another 90 days. Recoverable files continue to count
  toward quota.
- Stream validated objects to a private clamd service with the `INSTREAM`
  protocol. Only a clean result becomes downloadable. Infected, unsupported,
  or repeatedly failed scans remain blocked and are purged.
- Run lifecycle maintenance each minute and provider reconciliation daily.
  Expire upload reservations after 15 minutes, purge stale pending rows after
  one hour, and delete untracked provider objects after 24 hours.

## Production Responsibilities

Provision one private R2 bucket per environment. R2 encrypts objects at rest;
keep all public access disabled and grant a bucket-scoped Object Read & Write
token to the application. Configure browser CORS only for approved frontend
origins and the `PUT`, `GET`, and `HEAD` operations required by signed
transfers.

Run the pinned official ClamAV image on the private application network and do
not expose port 3310 publicly. The API fails closed: it only issues download
URLs after PostgreSQL records a clean scan result.

R2 does not implement S3 object tagging, so PostgreSQL is the authoritative
lifecycle ledger. The application reconciles and deletes untracked objects;
configure compatible bucket lifecycle safeguards as an additional backstop.

R2 credentials are loaded through the standard AWS SDK credential chain. Use a
dedicated bucket-scoped API token and rotate it through the deployment secret
store.

## Consequences

Development file handling has no cloud cost and exercises the same reservation,
validation, authorization, quota, deletion, and download rules as production.
The transfer mechanism differs by provider: local bytes pass through the API,
while production bytes transfer directly between the browser and R2.

R2 policy, lifecycle, CORS, and ClamAV signature freshness remain deployment
responsibilities. The repository provides Compose and Render definitions plus
the deployment runbook.
