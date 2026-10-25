-- LUMAR advertising order creation + durable idempotency — DRAFT ONLY.
-- NOT APPLIED. Depends on 20261022160000_lumar_advertising.sql.
-- Review against the actual Preview schema and migration history before use.
-- This SQL does not enable Stripe Checkout or alter any environment settings.
--
-- SECURITY BOUNDARY:
-- The API must authenticate Supabase Auth, verify salon ownership, validate content,
-- derive package placement and price from lib/advertising/catalog.ts, and compute a
-- stable request hash server-side. Never pass client-supplied price/status/user IDs.
-- Execute only with service_role after review; no client role may call these functions.

begin;

create table if not exists public.ad_order_idempotency (
  advertiser_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  campaign_id uuid null references public.ad_campaigns(id) on delete restrict,
  order_id uuid null references public.ad_orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (advertiser_user_id, idempotency_key),
  constraint ad_order_idempotency_result_pair check (
    (campaign_id is null and order_id is null) or
    (campaign_id is not null and order_id is not null)
  )
);

alter table public.ad_order_idempotency enable row level security;

-- Create both records in one database transaction. All passed fields must already
-- be validated/derived by the trusted server route. A mismatch on a reused key fails.
create or replace function public.lumar_create_advertising_order(
  p_advertiser_user_id uuid,
  p_advertiser_type text,
  p_client_type text,
  p_package_id text,
  p_salon_id uuid,
  p_placement text,
  p_placement_slot text,
  p_title text,
  p_body text,
  p_destination_url text,
  p_image_path text,
  p_duration_days integer,
  p_amount_minor bigint,
  p_idempotency_key text,
  p_request_hash text
)
returns table (campaign_id uuid, order_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_campaign_id uuid;
  v_order_id uuid;
  v_existing_hash text;
  v_existing_campaign uuid;
  v_existing_order uuid;
begin
  if p_advertiser_user_id is null
     or p_amount_minor is null or p_amount_minor <= 0
     or p_duration_days not in (7, 30, 90)
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200
     or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid order creation arguments' using errcode = '22023';
  end if;

  -- Explicit NULL checks matter: SQL three-valued logic means "NULL NOT IN (...)"
  -- evaluates to NULL rather than TRUE. DB constraints remain the final guardrail.
  if p_advertiser_type is null
     or p_advertiser_type not in ('salon', 'external')
     or p_client_type is null
     or p_client_type not in ('salon_w_aplikacji', 'firma_zewnetrzna')
     or p_package_id is null
     or p_package_id not in ('listing_highlight', 'featured_profile', 'in_app_banner', 'home_screen_banner', 'sponsored_carousel')
     or p_placement is null
     or p_placement not in ('salon_catalog', 'lumar_pages')
     or p_placement_slot is null
     or p_placement_slot not in ('salon_listing', 'featured_profile', 'in_app_banner', 'home_screen_banner', 'sponsored_carousel')
     or p_title is null or char_length(p_title) not between 3 and 120
     or p_destination_url is null or char_length(p_destination_url) not between 1 and 2048
     or (p_body is not null and char_length(p_body) > 500)
     or (p_image_path is not null and char_length(p_image_path) > 1024) then
    raise exception 'Invalid campaign fields' using errcode = '22023';
  end if;

  insert into public.ad_order_idempotency (
    advertiser_user_id, idempotency_key, request_hash
  ) values (
    p_advertiser_user_id, p_idempotency_key, p_request_hash
  ) on conflict (advertiser_user_id, idempotency_key) do nothing;

  -- Concurrent same-key calls serialize on the unique row.
  select request_hash, ad_order_idempotency.campaign_id, ad_order_idempotency.order_id
    into v_existing_hash, v_existing_campaign, v_existing_order
    from public.ad_order_idempotency
   where advertiser_user_id = p_advertiser_user_id
     and idempotency_key = p_idempotency_key
   for update;

  if v_existing_hash is distinct from p_request_hash then
    raise exception 'Idempotency key reused with different request' using errcode = '23505';
  end if;

  if v_existing_campaign is not null and v_existing_order is not null then
    return query select v_existing_campaign, v_existing_order, true;
    return;
  end if;

  -- This function is only callable by service_role. Salon ownership must be checked
  -- by the route before calling; the schema consistency constraint checks type/ID shape.
  insert into public.ad_campaigns (
    advertiser_user_id, advertiser_type, client_type, package_id, salon_id,
    placement, placement_slot, title, body, destination_url, image_path,
    duration_days, status
  ) values (
    p_advertiser_user_id, p_advertiser_type, p_client_type, p_package_id, p_salon_id,
    p_placement, p_placement_slot, p_title, p_body, p_destination_url, p_image_path,
    p_duration_days, 'pending_payment'
  ) returning id into v_campaign_id;

  insert into public.ad_orders (
    campaign_id, advertiser_user_id, package_id, client_type, duration_days,
    amount_net_minor, amount_total_minor, currency, status
  ) values (
    v_campaign_id, p_advertiser_user_id, p_package_id, p_client_type, p_duration_days,
    p_amount_minor, p_amount_minor, 'PLN', 'pending'
  ) returning id into v_order_id;

  update public.ad_order_idempotency
     set campaign_id = v_campaign_id,
         order_id = v_order_id,
         updated_at = now()
   where advertiser_user_id = p_advertiser_user_id
     and idempotency_key = p_idempotency_key;

  return query select v_campaign_id, v_order_id, false;
end;
$function$;

revoke all on function public.lumar_create_advertising_order(
  uuid, text, text, text, uuid, text, text, text, text, text, text, integer,
  bigint, text, text
) from public, anon, authenticated;
grant execute on function public.lumar_create_advertising_order(
  uuid, text, text, text, uuid, text, text, text, text, text, text, integer,
  bigint, text, text
) to service_role;

commit;

-- REQUIRED REVIEW BEFORE APPLYING:
-- 1. Confirm migration history, table definitions, and RPC signature in isolated Preview DB.
-- 2. Ensure the API checks salon ownership and package/placement consistency before RPC call.
-- 3. Add strict URL protocol/host validation and a safe image-storage policy in the API.
-- 4. Confirm amount_minor equals server catalog price * 100; do not trust request body.
-- 5. Add integration tests for concurrent duplicate calls, key/hash mismatch, transaction rollback,
--    invalid salon ownership, and schema constraints.
-- 6. Verify the RPC's idempotency key behavior under concurrent transactions in the target Postgres.
-- 7. Keep quote payable=false and Checkout/webhook disabled until full review.
