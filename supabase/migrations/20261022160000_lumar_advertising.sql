-- LUMAR advertising tables — VERSIONED MIGRATION DRAFT ONLY
-- Prepared on feature/lumar-advertising-plan for review.
-- NOT APPLIED to Supabase. Confirm Preview/Production project mapping before execution.
-- Review the design notes in docs/advertising-supabase-reconciliation.md first.
--
-- Safety: no direct anon/authenticated policies are granted here. Server routes must
-- verify Supabase Auth tokens, use server-side authorization and fail closed on errors.
--
-- Original reviewed schema proposal adapted as a versioned draft.
-- Do not run this file against production. Reconcile Supabase migration history first.
-- Uses new tables only; intentionally has no policies granting direct client writes.
-- Public display should use a server route that returns a strict field allowlist.

begin;

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_user_id uuid not null references auth.users(id) on delete restrict,
  advertiser_type text not null check (advertiser_type in ('salon', 'external')),
  client_type text not null check (client_type in ('salon_w_aplikacji', 'firma_zewnetrzna')),
  package_id text not null check (package_id in (
    'listing_highlight', 'featured_profile', 'in_app_banner',
    'home_screen_banner', 'sponsored_carousel'
  )),
  salon_id uuid null references public.salons(id) on delete restrict,
  placement text not null check (placement in ('salon_catalog', 'lumar_pages')),
  placement_slot text not null check (placement_slot in (
    'salon_listing', 'featured_profile', 'in_app_banner',
    'home_screen_banner', 'sponsored_carousel'
  )),
  title text not null check (char_length(title) between 3 and 120),
  body text null check (body is null or char_length(body) <= 500),
  destination_url text not null check (char_length(destination_url) <= 2048),
  image_path text null check (image_path is null or char_length(image_path) <= 1024),
  duration_days integer not null check (duration_days in (7, 30, 90)),
  status text not null default 'draft' check (status in (
    'draft', 'pending_payment', 'pending_review', 'scheduled',
    'active', 'rejected', 'paused', 'completed', 'cancelled'
  )),
  starts_at timestamptz null,
  ends_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  moderation_note text null check (moderation_note is null or char_length(moderation_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaign_advertiser_salon_consistency check (
    (advertiser_type = 'salon' and client_type = 'salon_w_aplikacji' and salon_id is not null) or
    (advertiser_type = 'external' and client_type = 'firma_zewnetrzna' and salon_id is null)
  ),
  constraint ad_campaign_package_slot_consistency check (
    (package_id = 'listing_highlight' and placement_slot = 'salon_listing' and placement = 'salon_catalog') or
    (package_id = 'featured_profile' and placement_slot = 'featured_profile' and placement = 'salon_catalog') or
    (package_id = 'in_app_banner' and placement_slot = 'in_app_banner' and placement = 'lumar_pages') or
    (package_id = 'home_screen_banner' and placement_slot = 'home_screen_banner' and placement = 'lumar_pages') or
    (package_id = 'sponsored_carousel' and placement_slot = 'sponsored_carousel' and placement = 'lumar_pages')
  ),
  constraint ad_campaign_dates_consistency check (
    (starts_at is null and ends_at is null) or
    (starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

create index if not exists ad_campaigns_public_eligibility_idx
  on public.ad_campaigns (placement, status, starts_at, ends_at);

create index if not exists ad_campaigns_owner_created_idx
  on public.ad_campaigns (advertiser_user_id, created_at desc);

create table if not exists public.ad_orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete restrict,
  advertiser_user_id uuid not null references auth.users(id) on delete restrict,
  package_id text not null check (package_id in (
    'listing_highlight', 'featured_profile', 'in_app_banner',
    'home_screen_banner', 'sponsored_carousel'
  )),
  client_type text not null check (client_type in ('salon_w_aplikacji', 'firma_zewnetrzna')),
  duration_days integer not null check (duration_days in (7, 30, 90)),
  amount_net_minor integer not null check (amount_net_minor > 0),
  tax_amount_minor integer null check (tax_amount_minor is null or tax_amount_minor >= 0),
  amount_total_minor integer null check (amount_total_minor is null or amount_total_minor >= amount_net_minor),
  currency text not null default 'PLN' check (currency = 'PLN'),
  status text not null default 'pending' check (status in (
    'pending', 'paid', 'failed', 'cancelled', 'refunded', 'disputed'
  )),
  stripe_checkout_session_id text null unique,
  stripe_payment_intent_id text null unique,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_orders_owner_created_idx
  on public.ad_orders (advertiser_user_id, created_at desc);

create table if not exists public.ad_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'click')),
  placement text not null check (placement in ('salon_catalog', 'lumar_pages')),
  occurred_at timestamptz not null default now()
);

create index if not exists ad_events_campaign_time_idx
  on public.ad_events (campaign_id, occurred_at desc, event_type);

-- Stripe webhook inbox for event deduplication and safe retry after transient failures.
-- A worker/route must claim rows atomically and retry stale 'processing' rows; the event ID
-- is globally unique per Stripe account/mode, while livemode is retained for auditing.
create table if not exists public.ad_stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null check (char_length(event_type) between 1 and 255),
  livemode boolean not null,
  processing_status text not null default 'received' check (
    processing_status in ('received', 'processing', 'processed', 'failed', 'ignored')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  processing_started_at timestamptz null,
  processed_at timestamptz null,
  last_error text null check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_stripe_event_processed_time_consistency check (
    (processing_status = 'processed' and processed_at is not null) or
    (processing_status <> 'processed' and processed_at is null)
  )
);

create index if not exists ad_stripe_webhook_events_retry_idx
  on public.ad_stripe_webhook_events (processing_status, processing_started_at, created_at);

alter table public.ad_campaigns enable row level security;
alter table public.ad_orders enable row level security;
alter table public.ad_events enable row level security;
alter table public.ad_stripe_webhook_events enable row level security;

-- Intentionally no anon/authenticated policies are added here.
-- New client roles therefore receive no direct table access until a separately reviewed
-- policy/API design is approved. Server-side routes must verify the session, salon ownership,
-- admin authorization, and all campaign/payment state transitions.

commit;

-- Before use:
-- 1. Confirm the production Supabase project and reconcile migration history.
-- 2. Add updated_at trigger strategy if used by the application.
-- 3. Confirm advertiser account eligibility, pricing source, VAT/receipts, refunds/disputes.
-- 3a. Populate package_id/client_type from the server-side catalog only; store net price snapshot.
-- 3b. Fill tax/total fields only from the configured tax/billing layer; do not hardcode VAT.
-- 4. Use ad_stripe_webhook_events as a deduplication inbox; claim/retry events atomically,
--    recover stale processing rows, and mark processed only after the order transition commits.
--    Do not rely on the browser success URL or metadata alone as proof of payment.
-- 5. Add carefully scoped read policy or public server API that returns only approved fields.
-- 6. This proposal does not create Stripe checkout, webhook handling, moderation UI, or reporting APIs.
