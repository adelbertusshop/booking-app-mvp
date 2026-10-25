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
