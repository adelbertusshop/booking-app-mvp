import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const apiUrl = process.env.LOCAL_SUPABASE_API_URL;
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;

if (!apiUrl || !serviceRoleKey) {
  throw new Error('Local Supabase API URL and service role key are required.');
}

const supabase = createClient(apiUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (url, init = {}) => fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(30000),
    }),
  },
});

const advertiserUserId = '7f5e2a10-7d45-4d8a-9a90-100000000099';
const salonId = '7f5e2a10-7d45-4d8a-9a90-200000000099';
const idempotencyKey = `concurrency-${randomUUID()}`;
const requestHash = createHash('sha256')
  .update(`lumar-concurrency-test:${idempotencyKey}`)
  .digest('hex');

const args = {
  p_advertiser_user_id: advertiserUserId,
  p_advertiser_type: 'salon',
  p_client_type: 'salon_w_aplikacji',
  p_package_id: 'listing_highlight',
  p_salon_id: salonId,
  p_placement: 'salon_catalog',
  p_placement_slot: 'salon_listing',
  p_title: 'Test równoległej rezerwacji reklamy',
  p_body: null,
  p_destination_url: 'https://example.test/concurrency',
  p_image_path: null,
  p_duration_days: 7,
  p_amount_minor: 4900,
  p_idempotency_key: idempotencyKey,
  p_request_hash: requestHash,
};

const attempts = 12;
const responses = await Promise.all(
  Array.from({ length: attempts }, () =>
    supabase.rpc('lumar_create_advertising_order', args)
  )
);

for (const response of responses) {
  if (response.error) {
    throw new Error(`Concurrent RPC failed: ${response.error.code} ${response.error.message}`);
  }
  assert.equal(response.data?.length, 1, 'each RPC call must return exactly one result');
}

const rows = responses.map((response) => response.data[0]);
const campaignIds = new Set(rows.map((row) => row.campaign_id));
const orderIds = new Set(rows.map((row) => row.order_id));

assert.equal(campaignIds.size, 1, 'all parallel calls must return the same campaign');
assert.equal(orderIds.size, 1, 'all parallel calls must return the same order');
assert.equal(rows.filter((row) => row.replayed === false).length, 1, 'exactly one call creates the order');
assert.equal(rows.filter((row) => row.replayed === true).length, attempts - 1, 'all other calls are idempotent replays');

const orderId = rows[0].order_id;
const campaignId = rows[0].campaign_id;

const [{ count: orderCount, error: orderError }, { count: campaignCount, error: campaignError }] =
  await Promise.all([
    supabase.from('ad_orders').select('id', { count: 'exact', head: true }).eq('id', orderId),
    supabase.from('ad_campaigns').select('id', { count: 'exact', head: true }).eq('id', campaignId),
  ]);

if (orderError) throw orderError;
if (campaignError) throw campaignError;

assert.equal(orderCount, 1, 'only one order row may exist for the parallel request');
assert.equal(campaignCount, 1, 'only one campaign row may exist for the parallel request');

const mismatch = await supabase.rpc('lumar_create_advertising_order', {
  ...args,
  p_request_hash: createHash('sha256').update('different-request').digest('hex'),
});
assert.equal(mismatch.error?.code, '23505', 'same key with a different request hash must be rejected');

process.stdout.write(
  `Concurrent idempotency test passed: ${attempts} parallel calls, one order, one campaign.\n`
);
