# LUMAR advertising backend — implementation gates

Status: planning document only. This is not a migration and does not authorize production changes.

## Confirmed product requirements
- Keep the approved 30 net-PLN prices in `lib/advertising/catalog.ts` unchanged.
- The five package IDs remain: `listing_highlight`, `featured_profile`, `in_app_banner`, `home_screen_banner`, `sponsored_carousel`.
- Client types remain `salon_w_aplikacji` and `firma_zewnetrzna`; durations remain 7, 30, and 90 days.
- Advertising slots in salon catalog/profiles and on LUMAR pages are separate.
- All paid placements must show a clear `Reklama` disclosure. The `Polecany` badge is additional.
- A campaign cannot start before verified payment and moderation approval. The duration starts at actual activation.
- No subscriptions or paid salon tiers in this phase.

## Current implementation boundary
- `POST /api/advertising/quote` is an unauthenticated, non-purchasing quote endpoint. It returns a server-catalog net price and `payable: false`; it must not create an order or campaign.
- The advertising page deliberately keeps purchase disabled.
- `docs/advertising-schema-proposal.sql` is review-only documentation. Do not execute it against any database until the project identity and migration history have been reconciled.
- Stripe Checkout and webhook handling are not yet implemented; do not describe the feature as payment-ready.
- Existing salon management UI is not proof of a platform-admin authorization system for advertising moderation.

## Required implementation sequence (preview/test only)
1. Verify the Supabase project URL from the Preview environment against the intended LUMAR project using non-secret metadata. Never print or expose secret values.
2. Define and test a server-side Supabase client that verifies the authenticated user from the request/session. Never trust a user ID supplied by the browser.
3. For `salon_w_aplikacji`, verify ownership of the selected salon using the authenticated user and the existing `salons.user_id` relationship. For `firma_zewnetrzna`, collect the required advertiser/contact data and associate the order with an authenticated user unless an explicitly reviewed guest-purchase model is adopted.
4. Add a reviewed migration only after checking the actual migration history and reconciling the proposal with existing schema. No production migration during this phase.
5. Create a campaign/order server-side from allowlisted inputs. Resolve package ID, slot, duration, and net amount from the server catalog only. Ignore/reject browser-supplied price, status, payment IDs, moderation state, and activation dates.
6. Implement Stripe Checkout using test-mode credentials only in Preview. Store the Checkout Session ID uniquely and bind metadata to internal order/campaign IDs. Never accept a success redirect as proof of payment.
7. Implement a signed webhook using the raw request body and the configured Stripe webhook secret. Verify signature and event type, enforce idempotency, and safely handle duplicate/out-of-order events. Only a verified successful payment can move an order to paid/pending review.
8. Add platform-admin authorization for moderation, separate from salon-owner permissions. Default-deny. Log reviewer, timestamp, decision, and bounded moderation note.
9. Activate only when both payment is verified and moderation is approved. Set `starts_at` to activation time and `ends_at` from the selected duration. Reject public display after expiry; never rely on a client-side timer.
10. Add server-only impression/click reporting with input validation, rate limiting/abuse controls, and a strict public field allowlist. Do not expose advertiser emails, internal IDs, payment identifiers, moderation notes, or unpublished campaigns.
11. Add automated tests for authorization, price tampering, salon ownership, invalid package/duration, webhook signature failures, duplicate webhook delivery, moderation bypass, activation timing, expiry, disclosure label, and reporting endpoints.
12. Run typecheck/lint/build and targeted tests in a feature branch and Preview deployment. Review the diff and test evidence before requesting approval.

## Environment and release guardrails
- No live Stripe credentials or live payment attempts during implementation/testing.
- Never place Stripe secret keys or Supabase service-role keys in client-exposed variables.
- Do not change Production environment variables, deploy to Production, run Production migrations, merge the PR, or activate real campaigns without the owner's explicit approval.
- If required Preview credentials are absent, stop at the code/test setup and report exactly which environment variables are missing by name only; never print their values.
- Keep the approved price matrix unchanged. Any pricing or tax-policy change requires explicit owner approval.
