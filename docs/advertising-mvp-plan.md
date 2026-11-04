# LUMAR Advertising MVP — implementation plan

## Scope and guardrails
- First release covers advertising only. Do not implement paid salon subscription/booking-limit changes in this release.
- Two independent placements: `salon_catalog` (salon promotions in the catalog) and `lumar_pages` (advertising placements on LUMAR pages).
- Campaign durations: 7, 30, or 90 days.
- Advertisers may be salons or external advertisers.
- No changes to production, production database, or production Stripe configuration until the owner explicitly approves the reviewed implementation and migration.
- Do not change existing authentication, booking, cancellation, email, or unrelated referral/commission projects.

## Repository audit snapshot
- Current default branch at audit: `main`, commit `8868f93c1ed6a4d6e6269e7e8b65815b8f6f8ad4`.
- `package.json` includes Next.js, Supabase JS/SSR, and Resend, but no Stripe SDK dependency was present in the inspected manifest.
- Repository tree inspection did not show a Stripe checkout or webhook route. This is not proof no integration exists outside the repository; verify actual Stripe Dashboard and Vercel environment linkage without exposing secret values.
- Vercel Stripe-related environment variable names have been observed, but values must never be printed or copied into logs.
- Existing public salon/catalog pages: `app/salon/[slug]/page.tsx`, `app/salony/page.tsx`; inspect their data flow before integration.
- Existing admin page is large (`app/admin/page.tsx`); avoid unrelated edits and prefer a narrowly scoped admin advertising area/component.
- Existing Supabase migration history in the repository is minimal. Confirm the exact production project and schema before writing or applying migrations.

## Proposed data model (review before implementation)
Use new tables only; do not alter booking tables:
1. `ad_campaigns`
   - id UUID primary key
   - advertiser_type enum/check: `salon` | `external`
   - salon_id nullable UUID only for salon-owned campaigns; FK target must be verified against the real schema
   - placement enum/check: `salon_catalog` | `lumar_pages`
   - title, destination_url, image/storage path, optional short copy
   - duration_days constrained to 7, 30, 90
   - status: `draft`, `pending_payment`, `pending_review`, `scheduled`, `active`, `rejected`, `paused`, `completed`, `cancelled`
   - starts_at/ends_at nullable until payment/review scheduling is finalized
   - created_at/updated_at
2. `ad_orders`
   - id UUID, campaign_id FK, amount_minor integer, currency ISO code, duration_days, status
   - Stripe Checkout Session ID and PaymentIntent ID unique where present
   - created_at/paid_at; store no card data and no secret keys
3. `ad_events` (optional first-release analytics)
   - id, campaign_id FK, event_type `impression`|`click`, created_at, placement, coarse deduplication token if approved by privacy review
   - minimize personal data; do not store raw IP addresses or unnecessary user identifiers

Final column names and foreign keys must be aligned to the actual schema after read-only inspection.

## Payment and activation rules
- Server creates Checkout Session using a server-only Stripe secret; never accept price/amount from the browser as authoritative.
- Prices come from server-side configuration or trusted database records; do not hardcode unapproved commercial prices.
- Use Stripe test mode in preview first.
- Verify webhook signature with the webhook signing secret.
- Webhook processing must be idempotent: a repeated event cannot create duplicate orders or activate/extend the campaign twice.
- A success/return URL alone never marks an order paid.
- Activate only after confirmed payment and ad moderation approval. Define whether the paid campaign's 7/30/90 days begin immediately after approval or at a scheduled start; proposed default is start after approval at the scheduled start.
- Failed/abandoned payment leaves campaign inactive.
- Refunds, disputes, and cancellation behavior must be defined before live payments are enabled.

## Access control and moderation
- RLS enabled for all new tables.
- Public visitors can read only approved campaigns that are active and within the time window; they cannot read orders or internal moderation fields.
- Salon owner may create/manage campaigns only for a salon they own; ownership must be checked server-side and by RLS.
- External advertiser submissions are pending review and never publish automatically.
- Admin moderation actions must use verified admin authorization; do not trust a client-supplied role flag.
- Validate destination URLs (HTTPS except explicitly approved local/test environments), image type/size, and copy length.

## Display and reporting
- Separate rendering components/configuration for each placement.
- Exclude paused, rejected, unpaid, not-yet-started, and expired campaigns.
- Rotate eligible ads fairly; do not promise impression volumes until traffic is measured.
- Count impressions only when an ad is actually rendered/visible according to the agreed definition; count clicks through a server-validated route or safe outbound link.
- Reporting windows: daily, weekly, monthly. Use aggregated counts and avoid collecting unnecessary personal data.

## Delivery sequence
1. Read-only verification of repository routes, Supabase project/schema/RLS, Vercel variable names, and Stripe mode/webhook setup.
2. Present confirmed findings, exact schema proposal, unknowns, and test plan for approval.
3. Implement on this branch only; add migration file but do not apply it to production.
4. Add unit/integration tests for duration validation, ownership, RLS expectations, checkout amount integrity, webhook signature/idempotency, approval, and expiry.
5. Open a draft PR; review CI/build and Vercel preview. Never merge or promote to production without explicit owner approval.
6. After approval, apply migration and enable live Stripe/webhook only in a separately approved release step.

## Acceptance criteria
- No changes to existing booking behavior or existing salon limits.
- Unpaid campaigns never render publicly.
- Campaigns cannot become active based only on a browser redirect.
- Duplicate webhook delivery does not duplicate payment/activation.
- Salon owners cannot access another salon's campaigns or orders.
- External ads require moderation.
- Both placements can be independently enabled/disabled.
- Expired campaigns stop rendering automatically.
- Daily/weekly/monthly reporting reconciles to stored events.
- Preview build and automated tests pass before any production release.
