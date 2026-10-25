# LUMAR advertising payments — review findings (2026-10-25)

Status: review note only. No migration has been applied, no database or Stripe settings were changed, and Checkout remains disabled.

## Confirmed source facts

- `lib/advertising/catalog.ts` is the source of truth for the approved customer-facing amount.
- `app/api/advertising/quote/route.ts` returns `payable: false`.
- `supabase/migrations/20261022160000_lumar_advertising.sql` defines `amount_net_minor`, nullable `tax_amount_minor`, and nullable `amount_total_minor`.
- `supabase/migrations/20261025120000_lumar_advertising_atomic_payment.sql` validates the received payment against `coalesce(amount_total_minor, amount_net_minor)`.
- The atomic SQL function does not verify Stripe signatures; the calling server route must do that before passing trusted event data.
- The repository contract states that the amount displayed in the catalog is the amount the advertiser is expected to pay and that no tax surcharge may be added to it.

## Blocker 1 — payment amount semantics are ambiguous

The atomic function accepts `amount_total_minor` as the expected payment whenever that field is non-null. The schema permits it to differ from `amount_net_minor`. That means the SQL alone does not enforce the approved catalog amount as the customer-facing payable amount.

### Required decision before implementation

Treat the catalog amount as the sole payable amount. Either:
1. make the persisted payment snapshot a single unambiguous `amount_payable_minor` copied from the server-side catalog, and validate Stripe against that exact field; or
2. document and enforce a schema invariant that `amount_total_minor = amount_net_minor` for this product, without adding a tax surcharge.

Do not silently choose a VAT/tax treatment in code. Accounting treatment is separate from the agreed amount charged to the customer and needs an explicit business/legal decision.

## Blocker 2 — event preconditions must be enforced at the route boundary

Before calling the database function, the webhook handler must:
- verify Stripe's signature against the raw request body using the environment-specific webhook secret;
- confirm the event type and live/test mode;
- confirm that the Checkout Session is paid (not merely completed if payment is delayed);
- verify the session/order association and exact amount/currency;
- record/deduplicate the event and handle retries without marking failed work as processed.

The repository's reviewed contract already requires these gates, but the inspected files do not establish that a webhook route exists or that these checks are implemented.

## Blocker 3 — database migration is not release-ready

The atomic migration depends on the base advertising migration and both are drafts. Before any application:
- verify the target Supabase project and environment;
- reconcile migration history and existing schema;
- run the migrations and integration tests against an isolated test database;
- test duplicate events, concurrent requests, invalid amount/session/mode, failed transactions, and out-of-order events;
- verify least-privilege execution and rollback behavior.

## Release decision

Keep `payable: false`. Do not apply migrations, configure live payment routes, enable real Checkout, or activate campaigns automatically until these blockers are closed and reviewed. A successful Vercel build/status alone does not prove payment correctness.
