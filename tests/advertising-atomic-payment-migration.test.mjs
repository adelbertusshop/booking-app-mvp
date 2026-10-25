import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../supabase/migrations/20261025120000_lumar_advertising_atomic_payment.sql', import.meta.url),
  'utf8',
);

test('atomic advertising payment function locks the webhook event and order', () => {
  assert.match(migration, /where stripe_event_id = p_event_id\s+for update/i);
  assert.match(migration, /where id = p_order_id\s+for update/i);
});

test('payment transition checks exact session, currency, amount, and environment mode', () => {
  assert.match(migration, /p_event_livemode is distinct from p_expected_livemode/i);
  assert.match(migration, /stripe_checkout_session_id is distinct from p_checkout_session_id/i);
  assert.match(migration, /p_amount_total_minor <> v_expected_amount/i);
  assert.match(migration, /v_campaign\.package_id <> v_order\.package_id/i);
  assert.match(migration, /v_campaign\.client_type <> v_order\.client_type/i);
  assert.match(migration, /v_campaign\.duration_days <> v_order\.duration_days/i);
  assert.match(migration, /upper\(coalesce\(p_currency, ''\)\) <> 'PLN'/i);
});

test('only pending orders can become paid and campaigns enter moderation, not active', () => {
  assert.match(migration, /where id = p_order_id\s+and status = 'pending'/i);
  assert.match(migration, /set status = 'pending_review'/i);
  assert.doesNotMatch(migration, /set status = 'active'/i);
});

test('duplicate processed events are idempotent and event processing shares the transaction', () => {
  assert.match(migration, /if v_event\.processing_status = 'processed' then\s+return 'duplicate_event'/i);
  assert.match(migration, /set processing_status = 'processed'/i);
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
});

test('function is not executable by public client roles', () => {
  assert.match(migration, /revoke all on function public\.lumar_apply_advertising_payment_success\([\s\S]*?\) from public, anon, authenticated;/i);
  assert.match(migration, /to service_role;/i);
  assert.match(migration, /verify Stripe's signature on the raw request body/i);
});

test('payment must equal the approved catalog amount and rejects a different stored total', () => {
  assert.match(
    migration,
    /v_order\.amount_total_minor is not null\s+and v_order\.amount_total_minor <> v_order\.amount_net_minor/i,
  );
  assert.match(migration, /v_expected_amount := v_order\.amount_net_minor/i);
  assert.match(migration, /p_amount_total_minor <> v_expected_amount/i);
});
