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
- `app/api/salons/route.ts` uses a server-created Supabase client and selects only `id, salon_name, slug` for rows marked `is_public=true`. `app/api/services/route.ts` explicitly comments that service-role credentials bypass RLS and performs a publication check server-side. New advertising endpoints must use strict field allowlists and repeat explicit campaign status/date checks server-side; do not rely on RLS alone when a service-role key is used.
- Therefore, Stripe environment-variable names alone do not establish that an end-to-end payment flow exists in the application.

### Vercel project/deployment/environment metadata (secret values were not read)
- Vercel project `booking-app-mvp` is a Next.js project associated with `lumaria-app.pl`, `www.lumaria-app.pl`, and the legacy Vercel aliases.
- Production deployment metadata resolves to repository `adelbertusshop/booking-app-mvp`, branch `main`, commit `8868f93c1ed6a4d6e6269e7e8b65815b8f6f8ad4`, state `READY`. This confirms the inspected production deployment's Git source/commit.
- Environment metadata includes `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, both targeting **Production only**.
- No variable named `STRIPE_WEBHOOK_SECRET` was present in the returned environment-variable metadata.
- Supabase URL/anon/service-role variable names are configured for Production and Preview, but the connector did not return the URL value when queried, so the exact Supabase project ref backing production remains unconfirmed. Do not infer that it is project `cnfrbelkckbtkzhwyxqm` until the public URL host or a matching project setting is verified.
- Stripe Dashboard mode, webhook endpoint, and enabled event types are outside what Vercel metadata proves. No Stripe-specific Dashboard connector is available in this connected tool set, so this must be verified by the owner in Stripe Dashboard before any payment implementation is enabled.

### Supabase project/schema/migrations
- Connected Supabase projects returned: active project `cnfrbelkckbtkzhwyxqm` (display name “wojciech Wojownik”) and an inactive project `nwdlsleogyyeiebnrsrw` (“firmy-baza-db”). The active project is a candidate for LUMAR, but its match to production has not been proven.
- Active project's `public.salons` uses UUID `id` and `user_id`, with `user_id` referencing `auth.users`; salon ownership can be tied to `auth.uid()`.
- `public.services`, `public.appointments`, and `public.salon_hours` refer to salons. Existing `appointments.id` is smallint in the inspected schema, so new advertising records must not assume all existing IDs are UUIDs.
- RLS is enabled on the inspected public tables and policies exist for salon-owner access. New advertising tables need their own narrowly scoped RLS policies; existing policies should not be weakened.
- The active Supabase project's migration history currently reports 10 migrations, from `20261004153150/tighten_public_rls_policies` through `20261016140954/optimize_overlapping_public_select_rls`. The repository's visible `supabase/migrations` folder has only a subset (including `202610050801_prevent_overlapping_appointments.sql`). The database and repository migration histories are therefore not a complete mirror. Reconcile before authoring or applying a migration; do not reset or reapply existing migrations.
- No Supabase Edge Functions were returned by the project listing.

## Security notes
- Never output secret values. Confirm only whether required variables are present and which deployment environments they apply to.
- Stripe webhooks must verify the signature against the untouched raw request body. A browser return URL is not proof of payment. Process webhook events idempotently.
- Do not activate campaigns until payment is verified server-side and moderation has approved the creative.
- No application runtime code, database schema, Stripe settings, or production deployment was changed during this audit. Repository changes are documentation only on the isolated branch.

## Outstanding verification before implementation
1. Confirm the production Supabase URL host/ref in Vercel project settings and match it to the connected Supabase project. Do not read or copy service-role values.
2. In Stripe Dashboard, verify whether the account is in test or live mode, whether Checkout/payment flows exist, and which webhook endpoints/events are configured. Do not create or edit endpoints yet.
3. Decide prices for each placement and duration, tax/receipt handling, refund/dispute rules, advertiser eligibility, and whether campaign duration starts on approval or a scheduled start. These are product decisions, not values to infer in code.
4. Reconcile Supabase migration history with the repository before authoring/applying a migration.
5. Inspect current RLS policies and grants for the exact public salon/catalog query paths; test proposed new policies in preview/dev before any production migration.

## Recommendation
Proceed with non-production implementation only after the owner reviews the specific price list and campaign rules. Build a draft PR and preview; do not merge, apply the migration to production, or enable live payment processing without explicit owner approval.
