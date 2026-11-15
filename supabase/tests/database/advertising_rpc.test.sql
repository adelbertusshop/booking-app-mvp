begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values ('7f5e2a10-7d45-4d8a-9a90-100000000001', 'lumar-advertising-rpc-test@example.test');

insert into public.salons (id)
values ('7f5e2a10-7d45-4d8a-9a90-200000000001');

-- First order creation and idempotent replay.
create temporary table first_order_result as
select *
from public.lumar_create_advertising_order(
  '7f5e2a10-7d45-4d8a-9a90-100000000001',
  'salon',
  'salon_w_aplikacji',
  'listing_highlight',
  '7f5e2a10-7d45-4d8a-9a90-200000000001',
  'salon_catalog',
  'salon_listing',
  'Testowa reklama',
  null,
  'https://example.test/ad',
  null,
  7,
  4900,
  'test-idem-0001',
  repeat('a', 64)
);

select ok(
  (select replayed = false from first_order_result),
  'first order request creates a new order'
);

create temporary table replay_order_result as
select *
from public.lumar_create_advertising_order(
  '7f5e2a10-7d45-4d8a-9a90-100000000001',
  'salon',
  'salon_w_aplikacji',
  'listing_highlight',
  '7f5e2a10-7d45-4d8a-9a90-200000000001',
  'salon_catalog',
  'salon_listing',
  'Testowa reklama',
  null,
  'https://example.test/ad',
  null,
  7,
  4900,
  'test-idem-0001',
  repeat('a', 64)
);

select ok(
  (select replayed = true from replay_order_result),
  'same idempotency key and hash return a replay'
);

select is(
  (select order_id::text from first_order_result),
  (select order_id::text from replay_order_result),
  'idempotent replay returns the original order ID'
);

select throws_ok(
  $$
    select *
    from public.lumar_create_advertising_order(
      '7f5e2a10-7d45-4d8a-9a90-100000000001',
      'salon',
      'salon_w_aplikacji',
      'listing_highlight',
      '7f5e2a10-7d45-4d8a-9a90-200000000001',
      'salon_catalog',
      'salon_listing',
      'Testowa reklama',
      null,
      'https://example.test/ad',
      null,
      7,
      4900,
      'test-idem-0001',
      repeat('b', 64)
    )
  $$,
  '23505',
  'Idempotency key reused with different request',
  'reusing an idempotency key with another request hash is rejected'
);

select is(
  (select count(*)::integer from public.ad_orders
   where advertiser_user_id = '7f5e2a10-7d45-4d8a-9a90-100000000001'),
  1,
  'idempotent retries do not create duplicate orders'
);

-- A valid test-mode payment advances the order but only queues moderation.
create temporary table payment_order_result as
select *
from public.lumar_create_advertising_order(
  '7f5e2a10-7d45-4d8a-9a90-100000000001',
  'salon',
  'salon_w_aplikacji',
  'listing_highlight',
  '7f5e2a10-7d45-4d8a-9a90-200000000001',
  'salon_catalog',
  'salon_listing',
  'Testowa reklama do płatności',
  null,
  'https://example.test/payment',
  null,
  7,
  4900,
  'test-pay-0001',
  repeat('c', 64)
);

update public.ad_orders
set stripe_checkout_session_id = 'cs_test_lumar_success'
where id = (select order_id from payment_order_result);

insert into public.ad_stripe_webhook_events (
  stripe_event_id, event_type, livemode
) values (
  'evt_test_lumar_success', 'checkout.session.completed', false
);

select is(
  public.lumar_apply_advertising_payment_success(
    'evt_test_lumar_success',
    (select order_id from payment_order_result),
    (select campaign_id from payment_order_result),
    '7f5e2a10-7d45-4d8a-9a90-100000000001',
    'cs_test_lumar_success',
    'pi_test_lumar_success',
    4900,
    'PLN',
    false,
    false
  ),
  'paid_pending_review',
  'valid test payment is recorded and queues campaign for moderation'
);

select is(
  (select status from public.ad_orders
   where id = (select order_id from payment_order_result)),
  'paid',
  'valid payment marks the order paid'
);

select is(
  (select status from public.ad_campaigns
   where id = (select campaign_id from payment_order_result)),
  'pending_review',
  'valid payment never activates an unreviewed campaign'
);

select is(
  public.lumar_apply_advertising_payment_success(
    'evt_test_lumar_success',
    (select order_id from payment_order_result),
    (select campaign_id from payment_order_result),
    '7f5e2a10-7d45-4d8a-9a90-100000000001',
    'cs_test_lumar_success',
    'pi_test_lumar_success',
    4900,
    'PLN',
    false,
    false
  ),
  'duplicate_event',
  'replaying a processed Stripe event is idempotent'
);

-- Invalid amount must not change the order, campaign, or event state.
create temporary table mismatch_order_result as
select *
from public.lumar_create_advertising_order(
  '7f5e2a10-7d45-4d8a-9a90-100000000001',
  'salon',
  'salon_w_aplikacji',
  'listing_highlight',
  '7f5e2a10-7d45-4d8a-9a90-200000000001',
  'salon_catalog',
  'salon_listing',
  'Testowa reklama — błędna kwota',
  null,
  'https://example.test/mismatch',
  null,
  7,
  4900,
  'test-pay-0002',
  repeat('d', 64)
);

update public.ad_orders
set stripe_checkout_session_id = 'cs_test_lumar_mismatch'
where id = (select order_id from mismatch_order_result);

insert into public.ad_stripe_webhook_events (
  stripe_event_id, event_type, livemode
) values (
  'evt_test_lumar_mismatch', 'checkout.session.completed', false
);

select throws_ok(
  $$
    select public.lumar_apply_advertising_payment_success(
      'evt_test_lumar_mismatch',
      (select order_id from mismatch_order_result),
      (select campaign_id from mismatch_order_result),
      '7f5e2a10-7d45-4d8a-9a90-100000000001',
      'cs_test_lumar_mismatch',
      'pi_test_lumar_mismatch',
      4901,
      'PLN',
      false,
      false
    )
  $$,
  '22023',
  'Verified Stripe amount does not match approved catalog amount',
  'Stripe amount mismatch is rejected'
);

select is(
  (select status from public.ad_orders
   where id = (select order_id from mismatch_order_result)),
  'pending',
  'amount mismatch leaves the order pending'
);

select is(
  (select status from public.ad_campaigns
   where id = (select campaign_id from mismatch_order_result)),
  'pending_payment',
  'amount mismatch leaves the campaign awaiting payment'
);

select is(
  (select processing_status from public.ad_stripe_webhook_events
   where stripe_event_id = 'evt_test_lumar_mismatch'),
  'received',
  'amount mismatch does not mark the webhook event processed'
);

select throws_ok(
  $$
    select public.lumar_apply_advertising_payment_success(
      'evt_test_lumar_mismatch',
      (select order_id from mismatch_order_result),
      (select campaign_id from mismatch_order_result),
      '7f5e2a10-7d45-4d8a-9a90-100000000001',
      'cs_test_lumar_mismatch',
      'pi_test_lumar_wrong_mode',
      4900,
      'PLN',
      false,
      true
    )
  $$,
  '22023',
  'Invalid or mismatched verified payment fields',
  'live/test mode mismatch is rejected before processing'
);

select * from finish();
rollback;
