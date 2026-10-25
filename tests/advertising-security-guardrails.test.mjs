import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const quoteRoute = await readFile(
  new URL('../app/api/advertising/quote/route.ts', import.meta.url),
  'utf8',
);
const authModule = await readFile(
  new URL('../lib/advertising/auth.ts', import.meta.url),
  'utf8',
);

test('advertising quote stays non-payable until Checkout and database gates are cleared', () => {
  assert.match(quoteRoute, /payable:\s*false/);
  assert.match(quoteRoute, /amountPayableMinor:\s*amountNetPln\s*\*\s*100/);
  assert.match(quoteRoute, /taxStatus:\s*'no_additional_tax_surcharge'/);
});

test('quote route validates package, client type, duration and bounds request body', () => {
  assert.match(quoteRoute, /MAX_REQUEST_BYTES\s*=\s*4\s*\*\s*1024/);
  assert.match(quoteRoute, /ADVERTISING_PACKAGES\.some/);
  assert.match(quoteRoute, /CLIENT_TYPES\.includes/);
  assert.match(quoteRoute, /ADVERTISING_DURATIONS\.includes/);
  assert.match(quoteRoute, /JSON\.parse\(boundedBody\.text\)/);
});

test('advertising authorization is server-only and fails closed when server config is missing', () => {
  assert.match(authModule, /^import 'server-only';/);
  assert.match(authModule, /if\s*\(!supabaseUrl\s*\|\|\s*!serviceRoleKey\)/);
  assert.match(authModule, /supabase\.auth\.getUser\(match\[1\]\)/);
  assert.match(authModule, /status:\s*503/);
  assert.match(authModule, /status:\s*401/);
});

test('platform admin access uses an explicit allowlist and denies by default', () => {
  assert.match(authModule, /LUMAR_PLATFORM_ADMIN_USER_IDS/);
  assert.match(authModule, /return configuredIds\.includes\(userId\.toLowerCase\(\)\)/);
  assert.match(authModule, /status:\s*403/);
});
