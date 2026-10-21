# LUMAR advertising payments — implementation gate

Status: planning/audit note for `feature/lumar-advertising-plan`. This is not a production change and does not enable payment collection.

## Read-only findings (2026-10-21)

- Stripe account visible to the connected Stripe integration: `Lumaria`, account context `acct_1ULQpCPDPK8kCgwX`, live mode.
- Read-only Stripe API returned zero active products and zero webhook endpoints for the live account.
- Repository `package.json` on this branch has no `stripe` dependency.
- Existing `/api/advertising/quote` is intentionally non-purchasing and returns `payable: false`.
- `docs/advertising-schema-proposal.sql` is a draft only. Do not apply it until migration history and the actual Supabase project are confirmed.
- Vercel environment metadata shows `STRIPE_SECRET_KEY` only for Production; no `STRIPE_WEBHOOK_SECRET` was found in the listed project environment variables. Secret values were not read.
- A server-side auth helper exists at `lib/advertising/auth.ts`, but it has not been wired into routes or build-tested.

## Required architecture

1. Keep all work on this branch and use Stripe test mode/test credentials for development. Never send test purchases to the live account.
2. Add the Stripe SDK using the repository's actual package manager and commit the matching lockfile. Do not hand-edit a lockfile.
3. Implement a server-only Checkout Session endpoint:
   - verify Supabase access token using `authenticateAdvertisingRequest`;
   - derive all prices and package metadata from `lib/advertising/catalog.ts`;
   - require salon ownership for `salon_w_aplikacji`, and never accept a caller-supplied price, total, status, or advertiser user ID;
   - persist a pending order/campaign only after the reviewed schema is deployed to the confirmed database;
   - set server-owned success/cancel URLs to the LUMAR domain;
   - include stable order/campaign identifiers in Stripe metadata and an idempotency key.
4. Implement a raw-body Stripe webhook route using `STRIPE_WEBHOOK_SECRET` and signature verification. Handle relevant Checkout events idempotently; never trust the browser redirect as proof of payment.
5. Reconcile order state and payment state in a transaction-safe way. Paid is not equal to approved: moderation must still approve before campaign activation. Start duration at actual activation, not checkout creation.
6. Test successful, cancelled, failed, duplicate, out-of-order and invalid-signature events in test mode.
7. Confirm VAT/tax handling, invoices/receipts, refunds/disputes, terms and privacy/legal wording before live activation.
8. Only after the owner explicitly approves the release should test-verified code be merged and production secrets/webhook configuration be added.

## Release blockers

- Confirm which Supabase project is production and reconcile its migration history.
- Review and approve the schema, including advertiser identity, campaign content validation, order amount snapshots, tax amounts, Stripe IDs and RLS.
- Establish the platform-admin UUID allowlist in the appropriate environment; default-deny is intentional.
- Add a dedicated Preview/test environment with Stripe test secret and test webhook signing secret. Do not copy live credentials to Preview.
- Confirm the Stripe account's business/tax configuration before accepting real payments.

## Safety boundary

No live products, prices, webhook endpoints, charges, refunds, or Supabase migrations were created by this audit. Live Stripe API reads were read-only.
