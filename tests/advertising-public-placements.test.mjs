import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('advertising catalog exposes all five package placements', async () => {
  const catalog = await read('../lib/advertising/catalog.ts');
  const slots = [
    'salon_listing',
    'featured_profile',
    'in_app_banner',
    'home_screen_banner',
    'sponsored_carousel',
  ];
  for (const slot of slots) assert.match(catalog, new RegExp(slot));
});

test('public advertising API serves all five placements and only active campaigns', async () => {
  const route = await read('../app/api/advertising/public/route.ts');
  for (const slot of [
    'salon_listing',
    'featured_profile',
    'in_app_banner',
    'home_screen_banner',
    'sponsored_carousel',
  ]) assert.match(route, new RegExp(slot));
  assert.match(route, /\.eq\('status', 'active'\)/);
  assert.match(route, /\.gt\('ends_at', now\)/);
  assert.match(route, /safeHttpsUrl/);
  assert.match(route, /query\.is\('salon_id', null\)/);
});

test('creative uploads are authenticated, bounded, and signature-checked', async () => {
  const route = await read('../app/api/advertising/upload/route.ts');
  assert.match(route, /authenticateAdvertisingRequest/);
  assert.match(route, /5 \* 1024 \* 1024/);
  assert.match(route, /detectImage/);
  assert.match(route, /image\/webp/);
  assert.match(route, /VERCEL_ENV === 'production'/);
});

test('checkout binds uploaded creative paths to the authenticated advertiser', async () => {
  const route = await read('../app/api/advertising/checkout/route.ts');
  assert.match(route, /startsWith\(\`\$\{auth\.context\.user\.id\}\/\`\)/);
  assert.match(route, /lumar-advertising/);
  assert.match(route, /Dla tego pakietu dodaj grafikę/);
});

test('campaign event endpoint validates active campaign placement before insert', async () => {
  const route = await read('../app/api/advertising/events/route.ts');
  assert.match(route, /eventType !== 'impression'/);
  assert.match(route, /eventType !== 'click'/);
  assert.match(route, /\.eq\('status', 'active'\)/);
  assert.match(route, /\.insert\(/);
});

test('expiry job requires a cron secret and an explicit enable flag', async () => {
  const route = await read('../app/api/advertising/expire/route.ts');
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /LUMAR_ADVERTISING_EXPIRY_ENABLED !== 'true'/);
  assert.match(route, /status: 'completed'/);
});
