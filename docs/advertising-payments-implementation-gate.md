# LUMAR advertising payments — implementation gate

Status: planning/audit note for `feature/lumar-advertising-plan`. This is not a production change and does not enable payment collection.

## Read-only findings (updated 2026-10-22)

- The owner reports that Stripe test publishable and secret keys have been added to Vercel and a redeployment completed.
- Vercel environment-variable metadata was independently inspected without decrypting or displaying values:
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is assigned to Production, Preview and Development.
  - `STRIPE_SECRET_KEY` is assigned to Production, Preview and Development.
  - `STRIPE_WEBHOOK_SECRET` was not present in the listed project environment-variable metadata.
- Variable names and targets alone cannot prove the values are test-mode keys. The owner reports that they are test keys; do not expose or request their values.
- **Configuration concern:** a Stripe test secret is currently reported to be assigned to Production as well as Preview/Development. Keep payment implementation fail-closed. Before release, isolate test credentials to Preview/Development and configure a separate live secret only after explicit production-release approval. A test secret cannot process live payments and may break any existing production Stripe flow if one exists.
- The connected Stripe MCP context previously exposed only the live account context and could not confirm a test-mode account. This is a limitation of the connected dashboard context, not proof that Vercel test credentials are invalid.
- Repository `package.json` and lockfile do not include the Stripe SDK; no Checkout or webhook routes exist yet.
- Existing `/api/advertising/quote` is intentionally non-purchasing and returns `payable: false`.
- `docs/advertising-schema-proposal.sql` is a draft only. Do not apply it until the actual Supabase project and migration history are confirmed.
- A server-side auth helper exists at `lib/advertising/auth.ts` and is marked `server-only`.
- The Vercel environment metadata did not show `LUMAR_PLATFORM_ADMIN_USER_IDS`; platform-admin access therefore remains default-deny until the correct verified Supabase Auth UUIDs are configured in the appropriate environment.

## Required architecture

1. Keep all work on `feature/lumar-advertising-plan`; no production changes. Use Stripe test mode for development.
2. Add the Stripe SDK using the repository's actual package manager and commit the matching lockfile. Do not hand-edit a lockfile.
3. Implement a server-only Checkout Session endpoint:
   - verify the Supabase access token using `authenticateAdvertisingRequest`;
   - derive package, duration, placement and price exclusively from `lib/advertising/catalog.ts`;
   - require server-side salon ownership for `salon_w_aplikacji`;
   - never accept a caller-supplied price, total, status, advertiser user ID or Stripe account mode;
   - persist a pending order/campaign only after the reviewed schema is deployed to the confirmed database;
   - use server-owned success/cancel URLs on the LUMAR domain;
   - use a stable idempotency key and server-owned order/campaign identifiers.
4. Implement a raw-body Stripe webhook route using `STRIPE_WEBHOOK_SECRET` and signature verification. Handle relevant Checkout events idempotently; never trust the browser redirect as proof of payment.
5. Reconcile order and payment state in a transaction-safe way. Payment confirmation is not campaign approval; moderation must approve separately. Campaign duration starts at actual activation.
6. Test successful, cancelled, failed, duplicate, out-of-order and invalid-signature events in test mode.
7. Confirm VAT/tax handling, invoices/receipts, refunds/disputes, terms and privacy/legal wording before live activation.
8. Only after the owner explicitly approves release may test-verified code be merged and production payment configuration changed.

## Release blockers

- Confirm which Supabase project is production and reconcile its migration history.
- Review and approve the schema, including advertiser identity, campaign content validation, order amount snapshots, tax amounts, Stripe IDs and RLS.
- Establish the platform-admin UUID allowlist in the appropriate environment; default-deny is intentional.
- Create a Stripe test webhook endpoint and store its signing secret as `STRIPE_WEBHOOK_SECRET` in Preview (and Development only if needed). Do not share the secret in chat.
- Verify the Preview and Production Stripe credential targets without revealing values; isolate test credentials from Production before any release.
- Confirm the Stripe account's business/tax configuration before accepting real payments.

## Safety boundary

No live products, prices, webhook endpoints, charges, refunds, or Supabase migrations were created by this audit. No secret values were read. Checkout remains disabled; environment-variable setup alone does not implement or enable payment collection.
