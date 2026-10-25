# LUMAR advertising order state machine — implementation contract

Status: design note for the feature branch only. This is not a database migration and does not enable payments.

## Fixed business rules

- Keep the approved catalog amounts exactly as published for 7, 30, and 90 days.
- Never add a tax surcharge to those displayed amounts.
- The quote API remains non-payable until the database and Stripe gates are implemented and reviewed.
- A paid campaign must enter `pending_review`; payment must never publish or activate an ad automatically.
- Do not treat a browser success URL, client-submitted amount, campaign metadata, or an unsigned webhook as proof of payment.

## Order transitions

Allowed order transitions should be implemented server-side and atomically:

| Current status | Event | Next status | Required guard |
| --- | --- | --- | --- |
| `pending` | Checkout session created | `pending` | Persist a unique Checkout Session ID; reuse an idempotency key for retries |
| `pending` | Verified payment success | `paid` | Verified Stripe signature; matching session/order/amount/currency; payment mode matches environment; conditional update only from `pending` |
| `pending` | Verified payment failure/expiry | `failed` or `cancelled` | Verified event and matching order/session; conditional update only from a compatible state |
| `paid` | Duplicate success event | `paid` | Idempotent no-op; do not create another campaign activation or order transition |
| `paid` | Refund/dispute event | Review-specific state | Verified event and a separately reviewed refund/dispute policy; never silently reactivate |

Terminal or incompatible transitions must fail closed. Out-of-order events must not downgrade a paid order to failed/cancelled.

## Campaign transitions

- New request: `draft` until server validation and order creation are complete.
- Once payment is confirmed: `pending_review`.
- Only an authorized platform moderator may move `pending_review` to `scheduled` or `rejected`.
- Only a scheduled, approved campaign with valid start/end timestamps may become `active`.
- Payment alone must never set `active`.
- Enforce the campaign/order transition in a database transaction or a single guarded database function, not as multiple unprotected client requests.

## Webhook inbox and concurrency

1. Verify the raw request body with the Stripe webhook signing secret before trusting event fields.
2. Insert the Stripe event ID into `ad_stripe_webhook_events` with a unique key. Duplicate event IDs are not processed twice.
3. Claim an event atomically; only one worker may own a live processing claim. Recover stale claims with a bounded retry policy.
4. In one transaction, validate the order and session mapping, conditionally update the order, and set the campaign to `pending_review` only if the paid transition actually occurred.
5. Mark the inbox event `processed` only after the state changes commit. Store bounded, non-secret error information on failure.
6. Check `livemode` against the expected environment and reject mode mismatches.
7. Never log secret keys, full payment payloads, bearer tokens, or personal/payment data unnecessarily.

## Checkout boundary

- Calculate the amount from the server-side advertising catalog; ignore any amount supplied by the browser.
- Persist an immutable price snapshot and the approved catalog amount.
- Use PLN and validate the exact amount/currency against the verified Stripe session/payment.
- Set an idempotency key derived from the server-created order ID.
- Do not expose the Stripe secret or service-role key to client bundles.
- Keep checkout disabled until Preview uses verified test-mode credentials, a Preview webhook secret is configured, the environment is mapped correctly, and tests cover duplicate/out-of-order events and concurrent requests.

## Required tests before enabling Checkout

- invalid/forged webhook signature rejected;
- duplicate event ID is idempotent;
- duplicate successful payment does not duplicate campaign transitions;
- out-of-order failure after success cannot downgrade a paid order;
- amount/currency/session/order mismatch is rejected;
- live/test mode mismatch is rejected;
- concurrent workers cannot claim and apply the same event twice;
- failed transaction does not mark event processed;
- only moderator allowlist can approve a campaign;
- payment leaves campaign in `pending_review`, never `active`;
- catalog amounts and durations remain unchanged.

## Explicit rollout boundary

This document changes no runtime code, environment variables, Stripe settings, or Supabase data. The existing SQL migration remains an unapplied draft. Do not apply it to Production or enable real payments without separate explicit approval.
