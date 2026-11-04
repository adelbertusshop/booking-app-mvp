# LUMAR advertising — live verification checkpoint

Date: 2026-10-24  
Branch: `feature/lumar-advertising-plan`  
Scope: read-only verification; no production changes.

## Verified against the connected Supabase project

Project ID: `cnfrbelkckbtkzhwyxqm` (`wojciech Wojownik`).

The current migration history returned by Supabase contains these latest entries:

- `20261016140954 optimize_overlapping_public_select_rls`
- `20261024115901 drop_global_appointment_time_unique`

The advertising migration `20261022160000_lumar_advertising` is **not** in the live migration history. The current public schema contains no `ad_campaigns`, `ad_orders`, `ad_events`, or `ad_stripe_webhook_events` tables. The advertising migration remains a repository draft and was not executed.

## Current branch code checks

- `lib/advertising/catalog.ts` and the advertising draft migration agree on the two top-level placements, five package IDs, customer types, and 7/30/90-day durations.
- `POST /api/advertising/quote` calculates a server-catalog net price but explicitly returns `taxStatus: "not_configured"` and `payable: false`.
- `lib/advertising/auth.ts` validates a Supabase bearer token server-side, fails closed when required configuration is absent, and checks salon ownership by `salons.id` plus `salons.user_id`.
- `package.json` does not currently declare the Stripe SDK.
- No confirmed Checkout or Stripe webhook route is present in the inspected branch.

## Environment mapping — not yet verified

A Vercel environment query filtered to `feature/lumar-advertising-plan` returned no entries. This result does **not** establish that the variables are absent; it means the branch-specific mapping could not be confirmed through that query. Earlier unfiltered metadata showed Stripe variables assigned to Production as well as Preview/Development, but secret values were not read and test/live mode was not independently verified.

Before Checkout can be implemented or enabled, verify in Vercel UI that Preview uses the intended Supabase project and test-only Stripe credentials, and ensure test credentials are not used by Production. Do not paste secret values into chat or commit them.

## Required implementation gates

1. Decide tax/VAT, invoice/receipt, and payable-total treatment. Catalog amounts are net PLN; no rate or total is assumed here.
2. Design a transaction-safe campaign/order creation operation.
3. Design an atomic webhook event claim/retry and payment-state transition; concurrent duplicate deliveries must not double-process.
4. Only then add Stripe SDK using the repository's package manager and implement Checkout/webhook in the test environment.
5. Keep successful payments at `pending_review`; payment must not publish a campaign.
6. Test success, cancellation, failed payment, invalid signature, duplicate/concurrent/out-of-order events, and recovery from partial failures.
7. Do not apply the migration, alter production environment settings, enable live payments, or merge to `main` without explicit release approval.

## Result

Build success on the branch remains useful but does not verify Checkout or webhook behavior. Advertising checkout remains intentionally non-payable; the live Supabase schema and production were not changed by this checkpoint.
