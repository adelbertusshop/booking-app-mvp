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

## Follow-up on 2026-10-25 — draft SQL guard added

The draft atomic function was updated to use `amount_net_minor` as the only expected payment amount and to reject the order if a non-null `amount_total_minor` differs from it. This makes the function fail closed when the stored order snapshot conflicts with the approved catalog amount; it does not add a tax surcharge.

A static regression assertion was added to `tests/advertising-atomic-payment-migration.test.mjs`. This is source-text testing only, not proof from executing PostgreSQL or Stripe integration tests.

Still required before release:
- ensure the server-side order-creation path copies the exact catalog amount into `amount_net_minor` and never trusts client-submitted prices;
- reconcile whether legacy tax/total columns should be simplified in a later versioned schema change;
- run the migration and integration tests against an isolated test database;
- implement and verify the signed Stripe webhook route and Checkout flow;
- keep quote response `payable: false` until all gates pass.

This remains a draft-only code change. No database migration was applied and no live payment configuration was changed.

## Follow-up audit — order creation and route inventory (2026-10-25)

Read-only inspection of the feature branch confirmed:

- `POST /api/advertising/quote` validates package, client type, and duration against the server-side catalog, returns the catalog amount, and keeps `payable: false`. It does not insert an order.
- The expected route files `app/api/advertising/checkout/route.ts` and `app/api/advertising/webhook/route.ts` were not found at those paths. No working Checkout or signed-webhook implementation has therefore been verified by this audit.
- `package.json` does not list the official `stripe` SDK dependency.
- `lib/advertising/auth.ts` provides server-side Supabase bearer-token verification and salon-ownership checking helpers. Their presence alone does not prove that order creation is implemented or that every future write route will use them.
- The review did not verify a server-side path that creates `ad_orders`, persists an immutable catalog-derived amount, or associates an order with a Checkout Session. This is an implementation gap to close before checkout work proceeds.

### Required next implementation sequence

1. Define and test the server-side order-creation contract first: authenticate with Supabase Auth; validate package/client type/duration against the catalog; derive price and PLN currency only on the server; validate salon ownership where applicable; persist a pending order with a stable idempotency strategy before creating Checkout; never accept a price, paid status, or privileged user ID from the browser.
2. Add the official Stripe SDK through the repository's package manager and commit the generated lockfile; do not hand-edit the lockfile.
3. Implement Checkout and the signed webhook only after the test database/schema and Preview secrets are verified. Keep webhook signature verification over the raw body and use the atomic database transition only after all Stripe/order checks pass.
4. Add automated tests for authentication, ownership, tampered client price, idempotent order creation, Checkout failure after order creation, invalid signature, duplicate webhook, unpaid session, currency/amount mismatch, and moderation state.
5. Keep `payable: false`, do not apply either draft migration, and do not change Production configuration until test evidence and explicit release approval exist.

This was a source inspection and documentation update only. No tests were executed, no database was changed, and no payment was created.

## Follow-up — quote regression coverage (2026-10-25)

Added static regression assertions in `tests/advertising-quote-safety.test.mjs` to guard that:
- the quote amount is computed by `getAdvertisingNetPrice` from the server-side catalog;
- the route does not read a client-submitted amount/price field;
- package, client type, and duration remain validated against server-side allowlists;
- the route remains non-payable and non-cacheable.

These are source-text assertions, not runtime/API integration tests. The test suite has not been executed in this environment, so no test pass is claimed. Checkout remains disabled and all database/Production changes remain out of scope.
