-- LUMAR advertising schema for production — PREPARED, NOT APPLIED.
-- Reconciled against the isolated LUMAR Preview schema on 2026-11-15.
-- No client-facing policies are created. All access is through authenticated server routes.
-- This migration creates schema objects only; it does not enable live Stripe payments.

begin;

create table public.ad_campaigns (
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
    (advertiser_type = 'salon' and client_type = 'salon_w_aplikacji' and salon_id is not null)
    or
    (advertiser_type = 'external' and client_type = 'firma_zewnetrzna' and salon_id is null)
  ),
  constraint ad_campaign_package_slot_consistency check (
    (package_id = 'listing_highlight' and placement_slot = 'salon_listing' and placement = 'salon_catalog')
    or (package_id = 'featured_profile' and placement_slot = 'featured_profile' and placement = 'salon_catalog')
    or (package_id = 'in_app_banner' and placement_slot = 'in_app_banner' and placement = 'lumar_pages')
    or (package_id = 'home_screen_banner' and placement_slot = 'home_screen_banner' and placement = 'lumar_pages')
    or (package_id = 'sponsored_carousel' and placement_slot = 'sponsored_carousel' and placement = 'lumar_pages')
  ),
  constraint ad_campaign_dates_consistency check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

create table public.ad_orders (
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

create table public.ad_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'click')),
  placement text not null check (placement in ('salon_catalog', 'lumar_pages')),
  occurred_at timestamptz not null default now()
);

create table public.ad_stripe_webhook_events (
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
    (processing_status = 'processed' and processed_at is not null)
    or (processing_status <> 'processed' and processed_at is null)
  )
);

create index ad_campaigns_public_eligibility_idx
  on public.ad_campaigns (placement, status, starts_at, ends_at);
create index ad_campaigns_owner_created_idx
  on public.ad_campaigns (advertiser_user_id, created_at desc);
create index ad_orders_owner_created_idx
  on public.ad_orders (advertiser_user_id, created_at desc);
create index ad_events_campaign_time_idx
  on public.ad_events (campaign_id, occurred_at desc, event_type);
create index ad_stripe_webhook_events_retry_idx
  on public.ad_stripe_webhook_events (processing_status, processing_started_at, created_at);

alter table public.ad_campaigns enable row level security;
alter table public.ad_orders enable row level security;
alter table public.ad_events enable row level security;
alter table public.ad_stripe_webhook_events enable row level security;

-- Explicitly remove inherited/default client grants. RLS alone is not the grant boundary.
revoke all on table public.ad_campaigns, public.ad_orders, public.ad_events,
  public.ad_stripe_webhook_events from public, anon, authenticated;
grant all on table public.ad_campaigns, public.ad_orders, public.ad_events,
  public.ad_stripe_webhook_events to service_role;

revoke all on sequence public.ad_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.ad_events_id_seq to service_role;

comment on table public.ad_campaigns is
  'LUMAR advertising campaigns. Access only through authenticated server routes.';
comment on table public.ad_orders is
  'LUMAR advertising orders. Access only through authenticated server routes.';
comment on table public.ad_events is
  'LUMAR advertising impression/click events. Access only through server routes.';
comment on table public.ad_stripe_webhook_events is
  'Private Stripe webhook inbox for deduplication and retry handling.';

commit;
