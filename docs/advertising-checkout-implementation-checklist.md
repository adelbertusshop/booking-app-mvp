# LUMAR advertising payments — implementation checklist

Status: engineering gate for `feature/lumar-advertising-plan`. This document does not enable payments and does not authorize production changes.

## Current verified state

- `POST /api/advertising/quote` validates package/client type/duration against the catalog and returns `payable: false`.
- `lib/advertising/catalog.ts` is the single price source. Preserve all existing catalog amounts; the quote API returns the same amount as `amountPayablePln`/`amountPayableMinor` and declares `taxStatus: no_additional_tax_surcharge`. Do not add a tax surcharge to the customer-facing amount. Keep accounting/tax reporting separate and do not infer a tax rate from this API label.
- `supabase/migrations/20261022160000_lumar_advertising.sql` is present in this branch, but the active Supabase migration history does not include it. Do not run it until the Preview/Production database mapping is confirmed.
- The live schema inspected in Supabase contains `public.salons` with `user_id` referencing `auth.users(id)`; no advertising tables were present.
- The remote branch's `package.json` does not include the Stripe SDK; Checkout and webhook routes are absent. Do not claim payments are implemented. If using Stripe's REST API directly, explicitly implement and test signature verification and idempotency; if adding the SDK, update the matching lockfile with the repository's package manager.
- Vercel has separate Stripe key entries for Production and Preview/Development. Their values were not read, so their actual test/live modes are not independently verified.
- The visible Vercel environment metadata does not list `STRIPE_WEBHOOK_SECRET` or `LUMAR_PLATFORM_ADMIN_USER_IDS`.

## Implementation order

### Gate 0 — environment identity
- Confirm which Supabase project is used by Vercel Preview and which by Production without exposing credentials.
- Confirm the Preview Stripe publishable/secret key pair is test-mode; ensure test credentials are not accidentally used by production flows.
- Configure a test webhook endpoint and `STRIPE_WEBHOOK_SECRET` only in Preview (and Development if required).
- Confirm the verified Supabase Auth UUIDs for platform-admin allowlisting. Keep admin access fail-closed until configured.

### Gate 1 — database contract
- Review migration against the confirmed database and its migration history before applying anywhere.
- Add database-enforced atomic operations for order/campaign creation and webhook status transitions; avoid multi-request best-effort rollback.
- Webhook event claiming must be atomic (unique event ID plus guarded status transition/lease), support retry after failure, and mark an event processed only after the order transition commits.
- Enforce snapshot consistency for package, duration, client type, campaign, and advertiser. Prices must come from the server catalog, never request payloads.
- Preserve the approved customer-facing catalog amount without adding a tax surcharge. Before charging, define how accounting fields map to that approved amount with a qualified accounting review if needed; do not invent a VAT rate or silently reinterpret legacy `amountNet*` fields. Verify the charged Stripe amount against the approved payable amount.
- Keep RLS enabled and no direct client writes to payment/order/event tables. Any privileged RPC must have a fixed safe `search_path`, minimal grants, and explicit authorization assumptions documented.

### Gate 2 — server-side Checkout
- Install a pinned Stripe SDK using the repository's actual package manager and update the matching lockfile.
- Require a valid Supabase bearer token; fail closed on missing/invalid auth.
- For LUMAR salons, verify `salons.user_id = auth.uid()` server-side. External advertisers must follow an explicit account/identity policy.
- Accept only package ID, client type, duration, campaign content and destination fields that are separately validated. Never accept caller-supplied price, tax, total, advertiser ID, payment status, or Stripe mode.
- Derive package placement and NET price exclusively from `lib/advertising/catalog.ts`.
- Use server-owned order/campaign IDs, a stable idempotency key, and fixed LUMAR success/cancel URLs.
- If Stripe session creation fails, leave no misleading payable order or recover it with a transaction-safe state transition.
- Keep all responses and logs free of secret values and sensitive payment data.

### Gate 3 — webhook
- Verify Stripe signature using the exact raw request body and `STRIPE_WEBHOOK_SECRET`; reject missing/invalid signatures.
- Verify `livemode` matches the environment's expected mode.
- Use Stripe event ID deduplication and atomic processing; safely handle duplicates, retries, out-of-order events, and stale processing leases.
- Verify session/order association and all expected currency/amount fields. Never trust browser redirects or metadata alone as payment proof.
- Payment changes order status to paid and campaign status to `pending_review`; it must not auto-activate the advertisement.
- Handle cancelled/failed/expired sessions and document refund/dispute transitions.

### Gate 4 — tests and preview release
- Unit tests: catalog-only price derivation, unchanged approved payable amount, invalid package/duration/client type, salon ownership, missing auth, invalid campaign content, amount mismatch.
- Integration tests: DB failure, concurrent duplicate Checkout request, invalid signature, duplicate webhook, out-of-order events, failed processing followed by retry.
- Stripe test-mode Preview run: successful payment, cancelled checkout, expired session, repeated webhook delivery.
- Run typecheck, lint, tests, and production build against the branch commit; report actual outputs, not assumed results.
- Verify the resulting order is paid and campaign is awaiting moderation. Verify no public route exposes unapproved campaigns.
- No production migration, live charge, live webhook, main merge, or production configuration change without separate explicit approval.

## Explicit non-goals for this gate
This gate does not claim to complete image uploads, ad impression/click analytics, refund/dispute automation, scheduled campaign expiry, or the advertiser management UI. Track those separately rather than implying they are delivered by Checkout.

## Completion evidence
Attach the tested branch commit, CI/build results, migration target confirmation, Stripe test-mode confirmation (without secrets), webhook delivery result, and the resulting database status transition. If any evidence is unavailable, mark the gate blocked rather than guessing.

## Live Supabase read-only verification — 2026-10-24

- Read-only inspection succeeded against project `cnfrbelkckbtkzhwyxqm` (`wojciech Wojownik`, region `eu-west-1`, status `ACTIVE_HEALTHY`). No credentials or secret values were read.
- The live migration history ends at `20261024115901 drop_global_appointment_time_unique`. It does not include `20261022160000_lumar_advertising`.
- Live `public` schema inspection found no `ad_campaigns`, `ad_orders`, `ad_events`, or `ad_stripe_webhook_events` tables. The advertising migration remains unapplied.
- Security advisor reported RLS enabled with no policies on `public.admin_settings`, `public.bookings`, and `public.providers`; it also reported Supabase Auth leaked-password protection disabled. These are findings to review separately, not a reason to weaken RLS or add broad policies.
- Existing live policies visible in the queried subset were on `appointments` and `salons`; no advertising table policies can be reviewed until those tables exist.
- This verification is read-only. No SQL writes, migrations, production configuration changes, payments, or releases were performed.

## Updated gate decision

**Still blocked before Checkout implementation:** the database contract has not been applied to a confirmed Preview database, and the draft migration does not yet provide the atomic database operations needed for safe order creation and webhook transitions. Do not implement a route that creates payable Stripe sessions until that contract is reviewed and available in an isolated Preview database. Keep `payable: false` and do not enable the purchase button.

## Follow-up verification — 2026-10-24 15:42 UTC

- Vercel Preview for branch `feature/lumar-advertising-plan`, commit `35bbf1d100e59854e2bbda7cfe12d62d83e1ce9c`, reached `READY`. This verifies deployment state only; it does not prove Stripe Checkout or the database workflow works.
- A fresh metadata-only environment-variable listing did not show any variables scoped specifically to this Git branch. The listing showed separate `STRIPE_SECRET_KEY` entries for Production and Preview/Development, plus publishable-key entries for those targets. Values were not decrypted or inspected.
- `STRIPE_WEBHOOK_SECRET` was still absent from the visible environment-variable metadata. Do not create a webhook endpoint or enable payment until a test endpoint and its signing secret are configured in Preview.
- No database writes were performed. The advertising migration remains unapplied; no Checkout/webhook routes were added by this verification.

## Follow-up verification — latest branch deployment

- The latest Preview deployment for this branch is `READY` at commit `ee10a08511d7aafd562d3156cd7c6963d10017ec`. Preview URL: `https://booking-app-gl0u6h008-grzegorzs-projects-dbc76bba.vercel.app`.
- This commit contains documentation only. Its successful deployment is not a test of checkout, database transactions, or webhook handling.
- A branch-specific Vercel environment-variable filter returned no branch-scoped variables. Project-level Preview/Development Stripe entries exist, but their values were not inspected. Do not infer test mode from the variable names or target alone.
- The next engineering task remains the reviewed transaction contract for orders, campaign snapshots, and idempotent webhook transitions. Until that contract is implemented and available in an isolated test database, keep the quote API non-payable and do not enable Checkout.



## Product decision — no paid Supabase test branch — 2026-10-24

- The product owner declined creation of a separate Supabase branch because of the additional hourly cost.
- Do not create or bill a Supabase branch. Keep the current live database unchanged during implementation.
- The product owner intends to apply the advertising database migration as part of the eventual production rollout. This is not permission to apply it now; obtain explicit release approval at that time and reconcile the live migration history immediately before execution.
- Because there is no isolated Supabase database, do not implement or enable a payable Checkout flow that depends on unverified live database writes. Continue with code review, validation, tests that do not mutate live data, and Preview-only checks. Keep quote responses `payable: false` until the database transaction contract and release procedure are approved.

## CI coverage review — 2026-10-24

- The current GitHub Actions workflow runs `npm ci`, `npm run lint`, and `npm run build` on Node.js 20.
- The workflow does not run a dedicated unit-test or integration-test command, and does not run an explicit `tsc --noEmit` typecheck step.
- Build success alone must not be reported as proof of payment correctness, webhook idempotency, or database transaction safety. Add suitable test coverage before enabling Checkout.


## CI verification — 2026-10-25

- Added `npm run typecheck` using `tsc --noEmit` in commit `66cdf8408ddc824e6e14157926ac57d0eda06367`.
- Added an explicit TypeScript typecheck step to GitHub Actions in commit `ceda80030bf5d251d65cb1243c2a4a736389e99c`.
- GitHub Actions run `40187703275` completed successfully: dependency installation, lint, typecheck, and build all passed.
- This confirms the current branch passes those CI steps only. Dedicated unit/integration tests for advertising pricing, authorization, Checkout, webhook retries, and atomic database transitions are still not present; payment readiness remains blocked.
- No migration, Supabase write, Stripe payment, production environment change, or merge to `main` was performed.
