# ShipFlow production deployment

ShipFlow deploys from the repository-level `render.yaml` Blueprint. The
Blueprint creates a paid Docker web service, a static frontend, a paid
PostgreSQL 18 database, and a private ClamAV service. Cloudflare R2, Resend,
Stripe, Google OAuth, and GitHub OAuth remain externally provisioned services.

## 1. Provision external services

Create these resources before the first Blueprint sync:

- A private Cloudflare R2 bucket and a bucket-scoped Object Read & Write API
  token. Record the access key ID, secret access key, bucket name, account ID,
  and S3 endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`). Do not
  enable public development URLs or a public custom domain.
- A verified Resend sending domain, API key, and webhook endpoint.
- A Stripe test-mode Pro product with USD 29 monthly and USD 290 annual
  recurring prices. Automatic Tax remains enabled by application policy.
- Google and GitHub OAuth applications.
- A Render workspace connected to this Git repository.

Configure this R2 bucket CORS policy, replacing the origin with the deployed
frontend origin:

```json
[
  {
    "AllowedOrigins": ["https://shipflow-web.onrender.com"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Length", "Content-Type", "x-amz-meta-*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

R2 supports presigned `PUT`, not HTML-form presigned `POST`. The API therefore
returns a raw-file `PUT` target for R2 while local development continues to use
the API's signed multipart `POST` endpoint. Object size, SHA-256, declared MIME
type, detected MIME type, and file signature are verified by the API before a
file can enter scanning or become downloadable.

## 2. Configure provider callbacks

Assuming Render grants the service names in `render.yaml`, use:

- Google redirect URI:
  `https://shipflow-api.onrender.com/api/v1/auth/oauth/google/callback`
- GitHub callback URL:
  `https://shipflow-api.onrender.com/api/v1/auth/oauth/github/callback`
- Stripe webhook:
  `https://shipflow-api.onrender.com/api/v1/webhooks/stripe`
- Resend webhook:
  `https://shipflow-api.onrender.com/api/v1/webhooks/resend`

Subscribe Stripe to the billing events documented in
`backend/docs/adr/0006-stripe-billing.md`. Store the resulting signing secret
as `STRIPE_WEBHOOK_SECRET`. Store Resend's Svix signing secret as
`RESEND_WEBHOOK_SECRET`.

If Render changes a service name because it is unavailable, use the actual URL
everywhere below and in the provider callback settings.

## 3. Sync the Render Blueprint

Create a Blueprint from the repository's `render.yaml`. During the first sync,
Render prompts for every variable marked `sync: false`.

Set backend variables as follows:

| Variable                                      | Value                                                     |
| --------------------------------------------- | --------------------------------------------------------- |
| `FRONTEND_URL`                                | `https://shipflow-web.onrender.com`                       |
| `CORS_ORIGINS`                                | The exact frontend origin, with no path or trailing slash |
| `EMAIL_FROM_ADDRESS`                          | Verified Resend sender address                            |
| `EMAIL_REPLY_TO` / `EMAIL_SUPPORT_ADDRESS`    | Monitored support address                                 |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET`    | Resend credentials                                        |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe test-mode credentials                              |
| `STRIPE_PRO_PRODUCT_ID`                       | Stripe test product ID                                    |
| `STRIPE_PRO_MONTHLY_PRICE_ID`                 | Stripe test monthly price ID                              |
| `STRIPE_PRO_ANNUAL_PRICE_ID`                  | Stripe test annual price ID                               |
| `S3_BUCKET`                                   | Private R2 bucket name                                    |
| `S3_ENDPOINT`                                 | R2 account S3 endpoint                                    |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Bucket-scoped R2 S3 credentials                           |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`   | Google OAuth credentials                                  |
| `GOOGLE_CALLBACK_URL`                         | Exact Google callback URL above                           |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`   | GitHub OAuth credentials                                  |
| `GITHUB_CALLBACK_URL`                         | Exact GitHub callback URL above                           |

Set frontend build variables:

| Variable            | Value                                      |
| ------------------- | ------------------------------------------ |
| `VITE_API_BASE_URL` | `https://shipflow-api.onrender.com/api/v1` |
| `VITE_APP_URL`      | `https://shipflow-web.onrender.com`        |

The Blueprint generates independent 256-bit base64 values for the JWT signing
secret and 2FA encryption key. Preserve these values during updates. Rotating
the JWT secret invalidates sessions; rotating the 2FA key requires a planned
credential migration and a version increment.

Render runs `prisma migrate deploy` as the API pre-deploy command. Automatic
deployment is gated on the GitHub CI checks. The database rejects public
connections (`ipAllowList: []`), and the API reaches PostgreSQL and ClamAV over
Render's private network.

## 4. Verify a release

After a successful deploy:

1. Confirm `GET /api/v1/health/live` and `GET /api/v1/health/ready` return 200.
2. Register a fresh user and confirm the verification message arrives.
3. Sign in with password, then repeat with Google and GitHub.
4. Enable 2FA, sign out, and confirm both TOTP and one single-use backup code.
5. Create an organization and complete a Stripe test checkout.
6. Upload a safe allowlisted file. It should move from `SCANNING` to `READY`.
7. Upload the standard EICAR test file only in a controlled test workspace. It
   should move to `REJECTED` and must never receive a download URL.
8. Confirm Stripe and Resend webhook deliveries are accepted and recorded.
9. Check API logs for bootstrap, database, scanner, or provider errors without
   exposing secrets or tokens.

## Operations and rollback

- Keep Render PostgreSQL point-in-time recovery/backups enabled and run the
  repository backup command before high-risk migrations.
- Treat a failed ClamAV connection as fail-closed: files remain unavailable and
  ultimately enter `FAILED`; do not disable scanning to clear the queue.
- Roll back application code by deploying the previous known-good commit.
  Prisma migrations are forward-only; restore a database backup when a schema
  rollback is required.
- Rotate any credential immediately if it appears in a log, screenshot, issue,
  or commit, then invalidate the old value at the provider.
- Account recovery is manual: support verifies identity out-of-band and an
  administrator manually disables 2FA. Email access alone never bypasses 2FA.

## Local production-path check

`backend/compose.yaml` includes PostgreSQL 18 and the pinned ClamAV image. To
exercise scanning locally, start Compose and configure:

```dotenv
FILE_STORAGE_PROVIDER=s3
FILE_MALWARE_SCAN_ENABLED=true
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
AWS_REGION=auto
S3_BUCKET=<private-r2-bucket>
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>
```

Never use production credentials in committed environment files.
