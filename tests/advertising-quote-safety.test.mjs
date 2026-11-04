import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const quoteRoute = await readFile(
  new URL('../app/api/advertising/quote/route.ts', import.meta.url),
  'utf8',
);

test('advertising quote cannot enable checkout before payment safety gates are implemented', () => {
  assert.match(quoteRoute, /payable:\s*false/);
});

test('customer payable amount remains exactly the approved catalog amount', () => {
  assert.match(quoteRoute, /amountPayablePln:\s*amountNetPln/);
  assert.match(quoteRoute, /amountPayableMinor:\s*amountNetPln\s*\*\s*100/);
  assert.match(quoteRoute, /taxStatus:\s*'no_additional_tax_surcharge'/);
});

test('quote response is not cacheable', () => {
  assert.match(quoteRoute, /'Cache-Control':\s*'no-store'/);
});

test('quote amount is derived from the server catalog, not a client-submitted price', () => {
  assert.match(quoteRoute, /getAdvertisingNetPrice\s*\(/);
  assert.match(quoteRoute, /const amountNetPln = getAdvertisingNetPrice\s*\(/);
  assert.doesNotMatch(quoteRoute, /input\.(?:amount|price|amountNetPln|amountPayablePln|amountPayableMinor)\b/);
});

test('quote validates package, client type, and duration against server allowlists', () => {
  assert.match(quoteRoute, /ADVERTISING_PACKAGES\.some\(\(item\) => item\.id === packageId\)/);
  assert.match(quoteRoute, /CLIENT_TYPES\.includes\(/);
  assert.match(quoteRoute, /ADVERTISING_DURATIONS\.includes\(/);
});
