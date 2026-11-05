# Meta Lead Ads webhook

This backend now supports one configured Facebook Page and its Instant Forms. Facebook and Instagram Instant Form submissions delivered through that Page become CRM enquiries. No Zapier/Make subscription or separate application server is needed. Register a Meta Developer App to obtain access; this change does not register the app, deploy the backend, apply the production migration, or subscribe your Page automatically.

## 1. Prepare the database and environment

1. Generate the Prisma client with `npm run db:generate`.
2. Apply `prisma/migrations/202611050001_meta_lead_webhook/migration.sql` through your existing migration workflow **before** enabling the webhook. For databases already managed by Prisma Migrate, use `prisma migrate deploy`. If the existing database was created with `db push` or repair SQL, reconcile/baseline its existing migration history first; do not blindly run all historical migrations against it. The new migration only adds the inbox table, index and enquiry relation.
3. Set the `META_*` variables and `CRON_SECRET` listed in `.env.example` on the backend host. Do not put tokens or App Secret in frontend/public environment variables.
4. Use an existing active branch for `META_DEFAULT_BRANCH_ID` and a non-banned CRM user for `META_INTEGRATION_USER_ID` (creation attribution). Optional `META_DEFAULT_ASSIGNEE_ID` must reference a non-banned user in the target branch, or a user with no branch restriction. An empty assignee leaves enquiries unassigned.
5. Explicitly set `META_GRAPH_API_VERSION` to a supported Graph API version available to your Meta app. There is no implicit version fallback.

Keep the verify token, App Secret, Page access token and worker secret separate. The worker secret should be a strong random value. Deployment can proceed without Meta configuration; these routes then fail closed or retain signed events without importing until retrieval/routing is configured.

## 2. Configure your Meta app and Page

1. In Meta for Developers, create/configure an app with the Lead Ads use case and associate it with the business that owns the Page.
2. Configure lead retrieval and Page subscription permissions. Confirm required permissions, access levels, App Review/business verification, and production mode in the app dashboard. A successful developer test is not proof that production customer leads are accessible.
3. Obtain the appropriate Page access token and grant the app access in the Page's Leads Access settings where applicable.
4. Deploy this backend to a public HTTPS URL.
5. Set the callback to `https://YOUR-BACKEND/api/v1/integrations/meta/webhook` and the verification token to `META_WEBHOOK_VERIFY_TOKEN`.
6. Subscribe to the Page object's `leadgen` field, and subscribe/install the app on the actual Page (`/{PAGE_ID}/subscribed_apps`). Configuring only the app-level callback is not sufficient.
7. Restrict `META_FORM_IDS` if only selected forms should enter the CRM. Empty means every form on this one Page. Other Pages, other change types and disallowed forms are acknowledged and ignored.

Reference: [Meta's lead retrieval setup checklist](https://github.com/facebookincubator/catalogue-of-api-solutions/blob/main/solutions/leads/leads-retrieval-set-up-checker.md).

## 3. Configure recovery processing

New signed deliveries are saved first; up to three due leads from that delivery are imported concurrently before responding. There is no detached work after the response. Duplicate and concurrent deliveries create at most one enquiry per Meta lead ID, including if that enquiry is later deleted. Different submissions from the same phone are retained as separate enquiries.

**Schedule `GET /api/v1/integrations/meta/process` every 1-5 minutes** with `Authorization: Bearer <CRON_SECRET>`. This is required to recover batches larger than three, temporary Graph/DB failures, events received before retrieval settings were finished, and requests interrupted after inbox insertion. Each request processes at most three due leads with an eight-second Graph timeout per lead. Increase call frequency if more than three leads arrive per interval. Keep traffic monitored: this is a bounded v1 importer, not an unlimited-throughput worker.

For Vercel deployments, configure Cron Jobs for the path above on a plan supporting your desired frequency. Vercel sends its `CRON_SECRET` bearer header automatically. This repository deliberately does not add a cron schedule that might exceed your hosting plan. Alternatively, an existing server/task scheduler can call the same endpoint; no automation platform is necessary. Do not expose the worker secret in a URL.

Manual recovery example (replace the domain and supply the secret through your environment):

```powershell
Invoke-RestMethod -Uri 'https://YOUR-BACKEND/api/v1/integrations/meta/process' -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

## 4. Mapping and failure handling

- `full_name` or `first_name` + `last_name` becomes candidate name; `phone_number`/`phone` becomes the phone with punctuation removed and existing country-code digits retained. No country code is guessed.
- Email and address fields map to their existing enquiry fields. Custom questions are preserved as labelled answers in Notes, alongside the external lead/form IDs.
- Source is `Meta Lead Ads`; status is `NEW`; branch/assignee come only from server configuration. There is no status-to-Meta feedback/Conversions API, historical backfill, OAuth connection screen, or per-form branch routing in this version.
- The inbox stores IDs and safe error codes, not raw lead contact payloads. Missing/invalid name, phone or email and unexpected form IDs are marked `NEEDS_ATTENTION`; no fabricated contact details are inserted. Inspect these records promptly in the database and resolve the source/mapping before resetting their status to `PENDING` and `nextAttemptAt` to the current time. There is no review UI in this version. Raw answers cannot be recovered from this inbox after they cease to be available through Meta.
- Transient retrieval, invalid routing configuration and database errors are retained/retried with exponential delay capped at 60 minutes. Fix revoked/expired tokens or invalid branch/user settings; the importer does not refresh tokens automatically.
- `meta_lead.status` is `PENDING`, `RETRY`, `NEEDS_ATTENTION`, or `IMPORTED`. Monitor counts/age of PENDING/RETRY rows and `lastError`, particularly `RETRIEVAL_OR_IMPORT_FAILED` and `INVALID_BRANCH_CREATOR_OR_ASSIGNEE`. Do not delete imported inbox IDs, or replay protection is lost.

## 5. Test and activate

Run `npm run typecheck` and `npm test`. Submit a test lead using Meta's Lead Ads Testing Tool and verify one `NEW` enquiry with the correct branch and custom answers. Re-deliver the same notification and verify it is not duplicated. Test a real controlled production submission after Meta access is approved; developer tests alone are insufficient. Then confirm your recovery scheduler is calling the protected endpoint successfully.

The GET callback returns the exact plain-text challenge for a valid verification token. POST requests require a valid `X-Hub-Signature-256` computed over the original request bytes with the App Secret. The normal CRM JWT is neither required nor accepted as a substitute for Meta's signature. Forged signatures, disabled configuration, malformed bodies and invalid worker credentials fail closed.
