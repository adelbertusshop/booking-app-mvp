-- LUMAR advertising schema proposal (REVIEW ONLY — NOT A MIGRATION)
-- Do not run this file against production. Reconcile Supabase migration history first.
-- Uses new tables only; intentionally has no policies granting direct client writes.
-- Public display should use a server route that returns a strict field allowlist.

begin;

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_user_id uuid not null references auth.users(id) on delete restrict,
  advertiser_type text not null check (advertiser_type in ('salon', 'external')),
  salon_id uuid null references public.salons(id) on delete restrict,
  placement text not null check (placement in ('salon_catalog', 'lumar_pages')),
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
    (advertiser_type = 'salon' and salon_id is not null) or
    (advertiser_type = 'external' and salon_id is null)
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
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  duration_days integer not null check (duration_days in (7, 30, 90)),
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

alter table public.ad_campaigns enable row level security;
alter table public.ad_orders enable row level security;
alter table public.ad_events enable row level security;

-- Intentionally no anon/authenticated policies are added here.
-- New client roles therefore receive no direct table access until a separately reviewed
-- policy/API design is approved. Server-side routes must verify the session, salon ownership,
-- admin authorization, and all campaign/payment state transitions.

commit;

-- Before use:
-- 1. Confirm the production Supabase project and reconcile migration history.
-- 2. Add updated_at trigger strategy if used by the application.
-- 3. Confirm advertiser account eligibility, pricing source, VAT/receipts, refunds/disputes.
-- 4. Add and test server-side authorization and webhook idempotency.
-- 5. Add carefully scoped read policy or public server API that returns only approved fields.
-- 6. This proposal does not create Stripe checkout, webhook handling, moderation UI, or reporting APIs.
