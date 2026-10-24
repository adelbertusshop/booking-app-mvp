# LUMAR advertising payments — implementation checklist

Status: engineering gate for `feature/lumar-advertising-plan`. This document does not enable payments and does not authorize production changes.

## Current verified state

- `POST /api/advertising/quote` validates package/client type/duration against the catalog and returns `payable: false`.
- `lib/advertising/catalog.ts` is the current price source. Prices are NET PLN; tax is explicitly not configured.
- `supabase/migrations/20261022160000_lumar_advertising.sql` is present in this branch, but the active Supabase migration history does not include it. Do not run it until the Preview/Production database mapping is confirmed.
- The live schema inspected in Supabase contains `public.salons` with `user_id` referencing `auth.users(id)`; no advertising tables were present.
- The remote branch's `package.json` does not include `stripe`; Checkout and webhook routes have not been confirmed.
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
- Decide tax/accounting semantics before charging. Do not invent a VAT rate. Verify `amount_net_minor`, `tax_amount_minor`, and `amount_total_minor` together against Stripe's amounts.
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
- Unit tests: catalog-only price derivation, invalid package/duration/client type, salon ownership, missing auth, invalid campaign content, tax mismatch.
- Integration tests: DB failure, concurrent duplicate Checkout request, invalid signature, duplicate webhook, out-of-order events, failed processing followed by retry.
- Stripe test-mode Preview run: successful payment, cancelled checkout, expired session, repeated webhook delivery.
- Run typecheck, lint, tests, and production build against the branch commit; report actual outputs, not assumed results.
- Verify the resulting order is paid and campaign is awaiting moderation. Verify no public route exposes unapproved campaigns.
- No production migration, live charge, live webhook, main merge, or production configuration change without separate explicit approval.

## Explicit non-goals for this gate
This gate does not claim to complete image uploads, ad impression/click analytics, refund/dispute automation, scheduled campaign expiry, or the advertiser management UI. Track those separately rather than implying they are delivered by Checkout.

## Completion evidence
Attach the tested branch commit, CI/build results, migration target confirmation, Stripe test-mode confirmation (without secrets), webhook delivery result, and the resulting database status transition. If any evidence is unavailable, mark the gate blocked rather than guessing.
