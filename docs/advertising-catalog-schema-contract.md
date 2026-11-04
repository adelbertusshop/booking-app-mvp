# LUMAR advertising — catalog/schema contract review

Status: read-only review of the current branch on 2026-10-24. No database or payment settings were changed.

## What matches

The server catalog in `lib/advertising/catalog.ts` and the draft migration `supabase/migrations/20261022160000_lumar_advertising.sql` agree on:
- the two top-level placements: `salon_catalog` and `lumar_pages`;
- five purchasable package IDs: `listing_highlight`, `featured_profile`, `in_app_banner`, `home_screen_banner`, `sponsored_carousel`;
- the package-to-slot and package-to-placement mapping;
- the allowed campaign durations: 7, 30, and 90 days;
- the two customer categories represented by the catalog and campaign schema.

The five packages are subtypes/slots within the two agreed advertising placements, not five separate top-level placement products.

## Items that must be resolved before Checkout implementation

1. **Tax and payable total:** the quote endpoint deliberately returns `taxStatus: "not_configured"` and `payable: false`. Catalog prices are net PLN. Do not infer a VAT rate or create a payable Checkout Session until the tax/invoicing treatment is approved and the exact total calculation is specified. The schema permits nullable tax/total fields and does not enforce `amount_total_minor = amount_net_minor + tax_amount_minor`.
2. **Atomic persistence:** the draft migration provides tables but no database RPC/transaction boundary for creating the campaign/order together or processing a webhook event and its order/campaign transitions atomically. Implementing multi-step writes from separate HTTP calls would permit partial state. Add narrowly scoped server-only database functions (safe `search_path`, least privilege, execute granted only to `service_role`) or another verified transaction-safe approach before accepting payment events.
3. **Webhook idempotency/retries:** `ad_stripe_webhook_events` is only an inbox table. It needs atomic event claiming, stale-processing recovery, and a single committed state transition. Duplicate and concurrent deliveries must not double-mark orders or activate campaigns.
4. **Environment separation:** the current gate document records Stripe key variables assigned to Production as well as Preview/Development, with values not independently verified. Do not enable Checkout until test credentials are isolated to non-production and the Preview Supabase mapping is confirmed. Never reveal or commit secrets.
5. **Identity consistency:** the catalog uses `salon_w_aplikacji` / `firma_zewnetrzna`; the database additionally stores `advertiser_type` as `salon` / `external`. Server-side validation must derive both from the same trusted customer type, never accept either from the request body, and require salon ownership for salon advertisers.
6. **Package snapshot:** order creation must store server-derived package, duration, client type, and net-price snapshot. Never trust the browser's amount or Stripe metadata as the source of price.

## Current implementation boundary

- `POST /api/advertising/quote` remains informational and non-payable.
- No Stripe SDK is currently declared in `package.json`; there is no confirmed Checkout or webhook route in the branch.
- The advertising migration remains a draft and must not be run against Supabase yet.
- No live payment, production schema change, production environment change, or merge to `main` is authorized by this review.

## Next safe engineering sequence

1. Approve tax/invoice treatment and confirm the exact total contract.
2. Design and test atomic database operations for order/campaign creation and webhook transitions.
3. Install Stripe SDK using npm and commit the generated `package-lock.json` update.
4. Implement Checkout behind fail-closed guards, then a raw-body signature-verified webhook.
5. Test success, cancellation, payment failure, invalid signature, duplicate delivery, concurrent delivery, out-of-order events, and partial-failure recovery in Preview/test mode.
6. Keep paid campaigns at `pending_review`; payment alone must never publish an advertisement.
