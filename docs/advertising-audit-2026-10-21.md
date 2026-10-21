# LUMAR advertising — read-only audit findings

Audit date: 2026-10-21
Repository: `adelbertusshop/booking-app-mvp`
Base commit: `8868f93c1ed6a4d6e6269e7e8b65815b8f6f8ad4`
Working branch: `feature/lumar-advertising-plan`

## Confirmed findings

### Application code
- `package.json` includes Next.js 14.2.35, Supabase JS/SSR, and Resend.
- The inspected dependency manifest does **not** include the official Stripe Node SDK.
- GitHub code searches for `stripe`, `checkout`, `webhook`, and `payment` returned no matching files/excerpts on the default branch; the repository tree did not contain an obvious Stripe Checkout or webhook route. The visible API routes are appointments, cancel-booking, salons, and services.
- Relevant existing UI routes include `app/salony/page.tsx`, `app/salon/[slug]/page.tsx`, and `app/admin/page.tsx`.
- Therefore, Stripe environment-variable names alone do not establish that an end-to-end payment flow exists in the application.

### Vercel project/environment metadata (values intentionally not read)
- Project `booking-app-mvp` is a Next.js project and has the LUMAR custom domains associated with it; the latest deployment returned by the project lookup was READY. This is metadata, not a live payment test.
- Environment metadata includes `STRIPE_SECRET_KEY` targeting **Production only** and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` targeting **Production only**.
- No variable named `STRIPE_WEBHOOK_SECRET` was present in the returned environment-variable metadata. No values were decrypted, printed, or copied.
- Supabase URL/anon/service-role variable names are configured for Production and Preview, but the values were not read. Thus the exact Supabase project backing production has **not yet been proven** from this read-only check.
- Stripe settings and endpoints in the Stripe Dashboard are outside what the Vercel metadata proves. Dashboard mode, webhook endpoint, and enabled event types still need an authorized read-only review.

### Supabase project/schema
- Connected Supabase projects returned: active project `cnfrbelkckbtkzhwyxqm` (display name “wojciech Wojownik”) and an inactive project `nwdlsleogyyeiebnrsrw` (“firmy-baza-db”). The active project is a candidate for LUMAR, but must be confirmed against the production deployment before any schema operation.
- Active project's `public.salons` uses UUID `id` and `user_id`, with `user_id` referencing `auth.users`; salon ownership can be tied to `auth.uid()`.
- `public.services`, `public.appointments`, and `public.salon_hours` refer to salons. Existing `appointments.id` is smallint in the inspected schema, so new advertising records must not assume all existing IDs are UUIDs.
- RLS is enabled on the inspected public tables and policies exist for salon-owner access. New advertising tables need their own narrowly scoped RLS policies; existing policies should not be weakened.
- Supabase migration history includes more migrations than the repository's visible `supabase/migrations` folder. This indicates migration history in the database and repository are not currently a complete mirror. Reconcile this before applying any new migration; do not reset or reapply existing migrations.
- No Supabase Edge Functions were returned by the project listing.

## Security notes
- Never output secret values. Confirm only whether required variables are present and which deployment environments they apply to.
- Stripe webhooks must verify the signature against the untouched raw request body. A browser return URL is not proof of payment. Process webhook events idempotently. See Stripe's official guidance: https://github.com/stripe/stripe-node and https://docs.stripe.com/api/idempotent_requests
- Do not activate campaigns until payment is verified server-side and moderation has approved the creative.
- No application code, database schema, Stripe settings, or production deployment was changed during this audit. Repository changes are documentation only on the isolated branch.

## Outstanding verification before implementation
1. Confirm that `cnfrbelkckbtkzhwyxqm` is the Supabase project used by the production LUMAR deployment.
2. In Stripe Dashboard, verify whether the account is in test or live mode, whether Checkout/payment flows exist, and which webhook endpoints/events are configured. Do not create or edit endpoints yet.
3. Decide prices for each placement and duration, tax/receipt handling, refund/dispute rules, advertiser eligibility, and whether campaign duration starts on approval or a scheduled start. These are product decisions, not values to infer in code.
4. Reconcile Supabase migration history with the repository before authoring/applying a migration.
5. Inspect current RLS policies and grants for the exact public salon/catalog query paths; test proposed new policies in preview/dev before any production migration.

## Recommendation
Proceed with implementation only on this branch after the owner reviews the audit and approves the specific price list and campaign rules. Build a draft PR and preview; do not merge, apply the migration to production, or enable live payment processing without explicit approval.
