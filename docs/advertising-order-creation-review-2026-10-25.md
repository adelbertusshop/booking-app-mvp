# LUMAR advertising order creation — compatibility review
Date: 2026-10-25
Branch: `feature/lumar-advertising-plan`

## Verified against repository files

- The order-creation draft uses the package IDs and placement values declared in `lib/advertising/catalog.ts`.
- Allowed durations match the catalog: 7, 30, 90 days.
- The base advertising migration defines `ad_campaigns`, `ad_orders`, and the relevant campaign/order states expected by the draft RPC.
- The catalog is the source of truth for amounts. The order RPC must only be called after the server route derives the amount from that catalog; the browser must never provide the authoritative price.
- `lib/advertising/auth.ts` authenticates a Supabase bearer token and includes a salon-ownership check. Any order route must call that ownership check for salon advertisers and stop on database errors.
- The quote route deliberately returns `payable: false`; keep that gate until checkout, signed webhook handling, configuration, schema, and tests have all been reviewed.

## Changes made in this review

- Explicitly reject null values for advertiser type, client type, package, placement, and placement slot in the draft SQL function. SQL `NULL NOT IN (...)` evaluates to NULL, so explicit null checks are required for a clear validation failure.
- Explicitly constrain destination URL length to 1–2048 characters in the function. This is only a length guard; the future API still needs protocol and host validation.
- No catalog prices were changed.
- No Supabase migration was applied.
- No Vercel production settings, live payment settings, or production data were changed.

## Remaining blockers before implementing or enabling checkout

1. Add the order-creation API route. Authenticate the caller, validate all fields and URL protocol, verify salon ownership, derive placement and price from the server-side catalog, compute a stable request hash, and call the service-role RPC only after all checks pass.
2. Add runtime tests against an isolated Preview database for concurrent duplicate requests, idempotency-key reuse with a different request hash, rollback, invalid salon ownership, and package/placement constraints. Static text assertions are not a substitute.
3. Verify the actual Preview Supabase project and migration history before applying either advertising migration. The SQL files remain drafts.
4. Implement Stripe Checkout and a webhook that verifies the Stripe signature over the raw request body, validates the expected test/live mode, amount, currency, and Checkout Session, and only then marks the order paid and campaign `pending_review`.
5. Confirm required server environment variables and secret configuration in the intended environment. Never expose the service-role key or webhook secret to the browser.
6. Verify Vercel build/deployment status and test the Preview application. At review time, the Vercel status for commit `15da3cfe28296665622464783a9dd79fe2e34c6c` was `pending`, so no successful deployment is claimed.

## Release rule

Do not apply the drafts to production, activate campaigns, or enable payable checkout until the blockers above are cleared and the owner explicitly approves the production step.
