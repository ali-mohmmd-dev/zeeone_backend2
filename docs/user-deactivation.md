# User deactivation

User management now deactivates accounts instead of deleting their business records.

## Release

Apply `prisma/migrations/202611050002_user_deactivation/migration.sql` using the normal database migration process before releasing the backend and frontend. Generate the Prisma client as part of the backend build. Existing accounts default to active and token version zero, so existing tokens continue to work until an account is deactivated.

## Behavior

- Administrators review pending work, choose an active replacement, then confirm **Transfer & Deactivate**. Accounts without pending work can be deactivated directly.
- Pending work includes jobs with pending leads (including overdue jobs), future/current empty jobs, pending job leads, open enquiries, enquiries with pending/rescheduled follow-ups or pending job leads, and pending/confirmed surveys/projects assigned to or handled by the departing user.
- Follow-ups remain attached to their enquiry. The enquiry's new owner receives access; the follow-up's creator is preserved.
- Completed/closed work retains its previous assignment. All creator and original assigner fields remain unchanged. Notes, invoices, payments, receipts and call records are retained.
- Replacement accounts must have access to the relevant modules and belong to the work's branch, or be administrators. A single administrator replacement can accept work across multiple branches.
- The server recomputes the preview before making changes. A changed list requires a new review. Transfers, deactivation, session removal and audit creation occur in one serializable transaction.
- Deactivation increments the account's token version and removes stored sessions. Every authenticated backend request checks activity and token version. Reactivation does not restore old tokens or reclaim transferred work.
- Inactive users remain in account management under the Inactive/All filter and are excluded from assignment options. Historical reports retain former users.
- Audit snapshots record the administrator, former user, replacement, timestamp and transferred record IDs. Account management shows the latest 20 events; transferred jobs also show assignment history.
- Permanent deletion is a separate, explicitly confirmed option for unused accounts only. The server checks all business relations and previous transfer snapshots again inside a transaction. Login accounts, sessions and notifications alone do not prevent deleting an otherwise unused account.
- Administrator accounts and self-deactivation are protected. The old REST DELETE endpoint rejects deletion and directs callers to the review workflow.

## Verification

Run backend/frontend type checks and the backend test suite. `src/modules/users/user-lifecycle.test.ts` covers transfers, authorship, stale previews, replacement validation, audit snapshots, account protections, unused-account deletion, reactivation and revoked tokens.

After applying the migration to a test database, manually verify a mixed workload: pending and completed jobs, a rescheduled follow-up, a completed call, an invoice and a survey. Confirm the pending items move, completed items and creators remain unchanged, old tokens fail before and after reactivation, and Cancel makes no changes.
