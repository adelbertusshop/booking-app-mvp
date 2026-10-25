-- LUMAR advertising atomic payment transition — DRAFT ONLY.
-- Do not apply to Supabase until project/environment mapping and the base migration are reviewed.
-- Intended for a verified server-side Stripe webhook only; this function does not verify Stripe signatures.
-- The caller must verify the raw-body signature and pass trusted, verified event fields.
-- No Checkout route, webhook secret, or payment activation is enabled by this migration.

begin;

create or replace function public.lumar_apply_advertising_payment_success(
  p_event_id text,
  p_order_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_total_minor bigint,
  p_currency text,
  p_event_livemode boolean,
  p_expected_livemode boolean
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_event public.ad_stripe_webhook_events%rowtype;
  v_order public.ad_orders%rowtype;
  v_campaign public.ad_campaigns%rowtype;
  v_expected_amount bigint;
  v_rows integer;
begin
  if p_event_id is null or length(p_event_id) not between 1 and 255
     or p_checkout_session_id is null or length(p_checkout_session_id) not between 1 and 255
     or p_payment_intent_id is null or length(p_payment_intent_id) not between 1 and 255
     or p_amount_total_minor is null or p_amount_total_minor <= 0
     or upper(coalesce(p_currency, '')) <> 'PLN'
     or p_event_livemode is distinct from p_expected_livemode then
    raise exception 'Invalid or mismatched verified payment fields' using errcode = '22023';
  end if;

  -- Serialize concurrent deliveries of the same Stripe event.
  select * into v_event
  from public.ad_stripe_webhook_events
  where stripe_event_id = p_event_id
  for update;

  if not found then
    raise exception 'Webhook event must be recorded before processing' using errcode = 'P0002';
  end if;

  if v_event.event_type <> 'checkout.session.completed'
     or v_event.livemode is distinct from p_event_livemode then
    raise exception 'Webhook event type or mode mismatch' using errcode = '22023';
  end if;

  if v_event.processing_status = 'processed' then
    return 'duplicate_event';
  end if;

  if v_event.processing_status not in ('received', 'processing', 'failed') then
    raise exception 'Webhook event is not in a processable state' using errcode = '55000';
  end if;

  select * into v_order
  from public.ad_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Advertising order not found' using errcode = 'P0002';
  end if;

  -- The checkout session must have been persisted server-side before payment.
  if v_order.stripe_checkout_session_id is distinct from p_checkout_session_id
     or v_order.currency <> 'PLN' then
    raise exception 'Checkout session or currency mismatch' using errcode = '22023';
  end if;

  v_expected_amount := coalesce(v_order.amount_total_minor, v_order.amount_net_minor);
  if p_amount_total_minor <> v_expected_amount then
    raise exception 'Verified Stripe amount does not match order snapshot' using errcode = '22023';
  end if;

  -- Lock and cross-check the campaign snapshot before changing payment state.
  select * into v_campaign
  from public.ad_campaigns
  where id = v_order.campaign_id
  for update;

  if not found
     or v_campaign.advertiser_user_id <> v_order.advertiser_user_id
     or v_campaign.package_id <> v_order.package_id
     or v_campaign.client_type <> v_order.client_type
     or v_campaign.duration_days <> v_order.duration_days then
    raise exception 'Advertising order and campaign snapshot mismatch' using errcode = '22023';
  end if;

  if v_order.status = 'paid' then
    -- A different event for the same already-paid order is an idempotent no-op,
    -- but it must still match the exact session, amount and currency above.
    update public.ad_stripe_webhook_events
      set processing_status = 'processed',
          processed_at = now(),
          processing_started_at = null,
          updated_at = now(),
          last_error = null
      where stripe_event_id = p_event_id;
    return 'already_paid';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Order is not payable from its current state' using errcode = '55000';
  end if;

  update public.ad_orders
    set status = 'paid',
        stripe_payment_intent_id = p_payment_intent_id,
        paid_at = now(),
        updated_at = now()
    where id = p_order_id
      and status = 'pending'
      and stripe_checkout_session_id = p_checkout_session_id;
  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception 'Concurrent order transition detected' using errcode = '40001';
  end if;

  -- Payment moves the campaign to moderation only; it never activates an ad.
  update public.ad_campaigns
    set status = 'pending_review',
        updated_at = now()
    where id = v_order.campaign_id
      and advertiser_user_id = v_order.advertiser_user_id
      and status in ('draft', 'pending_payment');

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Campaign is not in a payable pre-review state' using errcode = '55000';
  end if;

  -- This update commits in the same transaction as the order and campaign changes.
  update public.ad_stripe_webhook_events
    set processing_status = 'processed',
        processed_at = now(),
        processing_started_at = null,
        updated_at = now(),
        last_error = null
    where stripe_event_id = p_event_id;

  return 'paid_pending_review';
end;
$function$;

-- The function is a privileged server-side boundary, never a client RPC.
revoke all on function public.lumar_apply_advertising_payment_success(
  text, uuid, text, text, bigint, text, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.lumar_apply_advertising_payment_success(
  text, uuid, text, text, bigint, text, boolean, boolean
) to service_role;

commit;

-- Important review notes:
-- 1. This migration depends on 20261022160000_lumar_advertising.sql being reviewed and applied first.
-- 2. A surrounding webhook route must verify Stripe's signature on the raw request body.
-- 3. Record the event with its actual Stripe event type before calling this function.
-- 4. Stripe checkout.session.completed may not mean funds are settled for delayed payment methods;
--    only call this function for an event/payment status explicitly verified as paid.
-- 5. The function raises on a bad event so the transaction rolls back; the route should record a
--    bounded failure in a separate transaction and return a retryable response where appropriate.
-- 6. No environment variables, database, Stripe settings, or production services are changed here.
