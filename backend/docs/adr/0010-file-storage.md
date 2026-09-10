# ADR 0010: Organization File Storage

## Status

Accepted on 2026-08-10.

## Decision

- Use private filesystem storage under `.data/files` in development and tests.
- Use a private AWS S3 bucket in production through the same provider contract.
- Require `FILE_STORAGE_PROVIDER=s3` and GuardDuty malware scanning in production.
- Upload directly to a signed provider target. Local targets are HMAC-signed API
  URLs; S3 targets are constrained presigned POST forms.
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
- Poll GuardDuty object tags idempotently. Only `NO_THREATS_FOUND` becomes
  downloadable. Infected, unsupported, or repeatedly failed scans remain
  blocked and are purged.
- Run lifecycle maintenance each minute and provider reconciliation daily.
  Expire upload reservations after 15 minutes, purge stale pending rows after
  one hour, and delete untracked provider objects after 24 hours.

## Production Responsibilities

Provision one bucket per environment in the application Region. Enable S3 Block
Public Access, bucket-owner-enforced object ownership, TLS-only access, default
SSE-S3 encryption, and least-privilege IAM for the application role. Configure
browser CORS only for approved frontend origins and the `POST`, `GET`, and
`HEAD` operations required by signed transfers.

Enable GuardDuty Malware Protection for S3 and scan the `objects/` prefix with
result tagging. Deny object reads unless `GuardDutyMalwareScanStatus` is
`NO_THREATS_FOUND`. The application also checks its database lifecycle status,
so provider policy and application authorization both gate downloads.

Configure S3 lifecycle rules to abort incomplete multipart uploads after one
day and expire objects tagged `shipflow-state=pending` after two days. The
application changes that tag as files move through scanning, ready, deleted,
and rejected states.

AWS credentials are loaded through the standard SDK credential chain. Use an
IAM role in production instead of long-lived access keys in environment files.

## Consequences

Development file handling has no cloud cost and exercises the same reservation,
validation, authorization, quota, deletion, and download rules as production.
The transfer mechanism differs by provider: local bytes pass through the API,
while production bytes transfer directly between the browser and S3.

GuardDuty, bucket policy, lifecycle, IAM, and CORS remain deployment resources.
The backend validates their expected behavior but does not provision AWS
infrastructure.
