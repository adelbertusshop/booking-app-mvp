# LUMAR Advertising MVP — release test plan

Status: proposed test plan; no tests executed yet because runtime code is not implemented.
Branch: `feature/lumar-advertising-plan`

## 1. Scope
- Placement A: `salon_catalog`
- Placement B: `lumar_pages`
- Campaign duration: 7, 30, or 90 days
- No salon subscription plans, booking limits, commission/referral changes, or production activation in this release.

## 2. Payment tests (Stripe test mode only)
1. Checkout amount is derived server-side from an approved price configuration; client-submitted amount/currency/duration cannot override it.
2. Unknown placement, duration other than 7/30/90, missing destination URL, invalid advertiser ownership, or invalid creative is rejected before creating Checkout Session.
3. Checkout Session metadata identifies a single campaign/order and is cross-checked against persisted records in the webhook.
4. Valid webhook signature + successful payment updates exactly one order; repeated delivery is idempotent.
5. Invalid signature, malformed event, unsupported event, missing order, amount/currency mismatch, unpaid/failed/cancelled Checkout Session do not activate an ad.
6. A browser return URL never marks an order paid.
7. Refund/dispute events update order/campaign according to the approved refund policy; until that policy is decided, live mode remains disabled.
8. If webhook secret or Stripe keys are missing in Preview, payment endpoints fail closed and do not create fake paid orders.

## 3. Campaign eligibility and scheduling
- Draft, pending payment, pending review, rejected, paused, cancelled, completed, future, and expired campaigns are never served publicly.
- A campaign can become active only after verified payment and explicit moderator approval.
- Campaign end is computed from a server-side approved start time plus the purchased duration; client timestamps are ignored.
- Two placements are queried/rendered independently; disabling one placement does not disable the other.
- Expired ads stop rendering without manual intervention.

## 4. Authorization and privacy
- Anonymous visitors can only read a strict public projection of eligible campaign fields.
- A signed-in salon owner can manage campaigns only for salons owned by their verified Supabase user ID.
- One salon owner cannot view/update another owner's campaigns or orders.
- A normal signed-in user cannot access the platform moderation queue.
- Moderation actions require a separate server-verified platform-admin authorization mechanism; existing salon-owner authentication is not enough.
- No card details, service-role keys, webhook secrets, raw IP addresses, or unnecessary personal identifiers are stored in analytics.
- Destination links are validated; redirects cannot be used to exfiltrate secrets or create open-redirect abuse.

## 5. Reporting
- Impressions and clicks are recorded separately per campaign and placement.
- Daily, weekly, and monthly totals use server-side time windows and are consistent with event counts.
- Bots/repeated refreshes cannot trivially inflate metrics; deduplication/rate-limiting rules must be agreed and tested.
- Analytics endpoints do not allow clients to submit arbitrary campaign IDs to read other advertisers' reports.

## 6. Regression tests
- Existing login, password reset, booking creation, overlap protection, cancellation, email notifications, public salon listing, and service listing remain unchanged.
- Existing salon limits and all referral/commission features remain unchanged.
- Build, lint, typecheck, unit tests, and preview smoke tests pass before merge.
- Test migration on a disposable/preview database first. Never use production as the test database.

## 7. Required human decisions before production
- Approved price matrix for both placements × 7/30/90 days.
- Advertiser eligibility and creative rules.
- VAT/invoice/receipt handling and refund/dispute/cancellation policy.
- Whether the paid duration starts immediately on approval or on a scheduled start.
- Confirmation of production Supabase project and Stripe Dashboard mode/webhook configuration.
- Explicit approval for production migration and live Stripe enablement.
