# ShipFlow public-demo deployment

The public portfolio demo uses a deliberately constrained, zero-cost profile:

- Render Free Web Service for the Docker backend
- Neon Free PostgreSQL 18 using a direct, TLS-protected connection string
- Cloudflare Pages for the React frontend and a same-origin API proxy Function
- Stripe test mode for billing
- Google and GitHub OAuth for public registration

The backend runs with `DEPLOYMENT_PROFILE=public-demo`; the frontend uses
`VITE_DEPLOYMENT_PROFILE=public-demo`. This profile is not the production
reference architecture. The production-grade R2, Resend, and ClamAV
implementations remain in the repository but are unavailable in the public
demo.

## Public-demo security boundary

The API, not only the frontend, blocks these capabilities in public-demo mode:

- password registration
- email verification and password recovery
- every file metadata, upload, download, and local-content endpoint
- the Resend webhook

Existing password accounts can still sign in, which preserves local and test
coverage, but the public interface offers Google and GitHub as the only account
creation paths. Organization invitations return a newly generated shareable URL
only to an authorized creator or resender. The raw token is never persisted and
is not returned by invitation-list endpoints.

The browser calls the API through the Pages origin at `/api/v1/*`. A Pages
Function forwards those requests to the fixed Render API origin without
rewriting the browser's `Origin` or Fetch Metadata headers. This keeps refresh
and OAuth-state cookies on the Pages host while preserving the backend's cookie
request checks. The Render API remains the authorization boundary; the Function
does not authenticate requests or grant access on its behalf.

Do not use this profile for a customer deployment. Switch back to `standard`,
configure Resend and a verified domain, and provision private R2 plus ClamAV.

## 1. Provision accounts and reserve URLs

1. Create or select the dedicated ShipFlow Hobby workspace in Render and
   connect the GitHub repository.
2. Create a Cloudflare Pages project from the repository. Use `frontend` as the
   root, `npm run build` as the build command, and `dist` as the output
   directory. Record the assigned `pages.dev` origin.
3. Create a Neon PostgreSQL 18 project in a region close to Render Singapore.
   Copy the **direct** connection string, including `sslmode=require`. ShipFlow
   uses its own bounded application pool, and startup migrations should not use
   the pooled hostname.
4. Create a Stripe test-mode Pro product with USD 29 monthly and USD 290 annual
   recurring prices.
5. Create Google and GitHub OAuth applications after the Pages production URL
   is known.

No R2 bucket, Resend key, sending domain, VirusTotal key, or hosted ClamAV
service is required for this deployment.

## 2. Configure and deploy the backend

Sync the repository-level `render.yaml` Blueprint into the dedicated ShipFlow
workspace. Set every value marked `sync: false`:

| Variable                                    | Value                                                   |
| ------------------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`                              | Neon direct PostgreSQL connection string                |
| `FRONTEND_URL`                              | Exact Cloudflare Pages origin, without a trailing slash |
| `CORS_ORIGINS`                              | The same exact Pages origin                             |
| `EMAIL_SUPPORT_ADDRESS`                     | Publicly monitored recovery/support address             |
| `STRIPE_SECRET_KEY`                         | Stripe test-mode secret key                             |
| `STRIPE_WEBHOOK_SECRET`                     | Stripe test webhook signing secret                      |
| `STRIPE_PRO_PRODUCT_ID`                     | Test product ID                                         |
| `STRIPE_PRO_MONTHLY_PRICE_ID`               | Test monthly price ID                                   |
| `STRIPE_PRO_ANNUAL_PRICE_ID`                | Test annual price ID                                    |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials                                |
| `GOOGLE_CALLBACK_URL`                       | Exact Google callback shown below                       |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth credentials                                |
| `GITHUB_CALLBACK_URL`                       | Exact GitHub callback shown below                       |

Use the actual Pages and Render hostnames in these URLs:

- Google: `https://<pages-host>/api/v1/auth/oauth/google/callback`
- GitHub: `https://<pages-host>/api/v1/auth/oauth/github/callback`
- Stripe: `https://<render-host>/api/v1/webhooks/stripe`

OAuth must start and return through Pages so the signed state cookie is
available at callback time. Stripe remains a direct server-to-server webhook
and does not pass through the Pages Function.

Render Free does not support pre-deploy commands. The Blueprint therefore
overrides the Docker command to run `prisma migrate deploy` before starting the
single API process. Migration failure prevents the application from starting.

The Blueprint generates the JWT signing secret and 2FA encryption key. Preserve
both values across updates. Rotating the JWT secret invalidates sessions;
rotating the 2FA key requires a planned credential migration and key-version
increment.

## 3. Configure Cloudflare Pages

Set these production build variables:

| Variable                    | Value                                      |
| --------------------------- | ------------------------------------------ |
| `VITE_API_BASE_URL`         | `https://<pages-host>/api/v1`              |
| `VITE_APP_URL`              | Exact `https://<project>.pages.dev` origin |
| `VITE_DEPLOYMENT_PROFILE`   | `public-demo`                              |
| `VITE_GOOGLE_OAUTH_ENABLED` | `true`                                     |
| `VITE_GITHUB_OAUTH_ENABLED` | `true`                                     |

`frontend/functions/api/[[path]].ts` proxies only versioned API routes to
`https://shipflow-rwv0.onrender.com`. Update its pinned upstream origin if the
Render hostname changes. It forwards request bodies, cookies, response cookies,
and OAuth redirects; it does not follow upstream redirects or cache API
responses. `frontend/public/_routes.json` invokes the Function only for
`/api/*`, leaving static assets outside the Functions quota.

Pages provides SPA fallback routing for non-Function routes because there is no
top-level `404.html`. Do not add a catch-all `_redirects` rule; Cloudflare
rejects `/* /index.html 200` as a loop. `frontend/public/_headers` supplies
the static site's CSP and browser security headers. Verify `_routes.json` and
`_headers` appear in the final `dist` directory after every build. Preview
deployment hostnames are different browser origins: use the main Pages URL for
OAuth and session testing.

### Proxy cutover

1. Publish the Function while the existing frontend still points directly at
   Render. Confirm `https://<pages-host>/api/v1/health/ready` returns 200.
2. Set Render `CORS_ORIGINS` and `FRONTEND_URL` to the exact main Pages origin.
   Set both OAuth callback variables to the Pages URLs above.
3. Replace the authorized callbacks in Google Cloud and the GitHub OAuth app.
4. Change the Pages production `VITE_API_BASE_URL` to its own `/api/v1` URL and
   trigger a new frontend build. Vite embeds this value at build time.
5. Test the main Pages URL. An anonymous session refresh should return 401 and
   show the login page, not a network error or 403. Then test both OAuth flows,
   reload/session renewal, 2FA, and logout.

Before public release, verify that the Render rate limiter still receives a
useful client address through the extra proxy hop. The Function strips
caller-supplied forwarding headers to avoid trusting a spoofed address.

## 4. Configure Stripe and OAuth

1. Add the deployed Stripe webhook URL and subscribe to the billing events in
   `backend/docs/adr/0006-stripe-billing.md`.
2. Copy its signing secret into Render and redeploy.
3. Add the exact Pages callback URLs to the Google and GitHub OAuth apps.
4. Add the exact Cloudflare Pages origin to any OAuth consent-screen and
   application-homepage settings that require it.

Never put provider secrets in Cloudflare frontend variables, repository files,
screenshots, issues, or CI logs.

## 5. Keep-warm monitor

Configure UptimeRobot or cron-job.org to request
`https://<render-host>/api/v1/health/ready` less than every 15 minutes. Treat it
as a demo convenience, not an availability guarantee. Render may still restart
or suspend a free instance, and Neon may scale its compute to zero.

## 6. Release verification

1. Confirm `/api/v1/health/live` and `/api/v1/health/ready` return 200 through
   the main Pages origin.
2. Confirm `/register`, `/forgot-password`, `/reset-password`, and
   `/verify-email` redirect to the OAuth-focused login experience.
3. Confirm direct API calls to password registration/recovery return 403.
4. Register fresh accounts with Google and GitHub.
5. Enable 2FA, sign out, then verify both TOTP and a single-use backup code.
6. Create an organization and generate a shareable invitation link. Confirm the
   link is displayed after creation but not in the pending-invitation list.
7. Confirm the Files navigation is absent and direct file API requests return 403.
8. Complete a Stripe test checkout and confirm webhook processing is recorded.
9. Inspect logs for migrations, database, OAuth, billing, or startup errors
   without exposing secrets.

## Upgrade path

For a paid/customer deployment:

1. Set both deployment profiles to `standard`.
2. Provision a verified Resend domain and webhook.
3. Provision a private R2 bucket with scoped credentials and origin-specific
   CORS.
4. Run the pinned ClamAV container as a private service.
5. Replace startup migrations with the platform's paid pre-deploy command.
6. Re-enable the password-email and file interfaces and run their production
   smoke tests.

Account recovery remains manual in either profile: support verifies identity
out-of-band and an administrator manually disables 2FA. Email access alone does
not bypass 2FA.
