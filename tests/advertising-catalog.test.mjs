import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/advertising/catalog.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const catalog = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const expectedPrices = {
  listing_highlight: {
    salon_w_aplikacji: { 7: 49, 30: 149, 90: 349 },
    firma_zewnetrzna: { 7: 99, 30: 299, 90: 699 },
  },
  featured_profile: {
    salon_w_aplikacji: { 7: 59, 30: 169, 90: 399 },
    firma_zewnetrzna: { 7: 119, 30: 349, 90: 799 },
  },
  in_app_banner: {
    salon_w_aplikacji: { 7: 129, 30: 349, 90: 799 },
    firma_zewnetrzna: { 7: 219, 30: 599, 90: 1299 },
  },
  home_screen_banner: {
    salon_w_aplikacji: { 7: 199, 30: 599, 90: 1399 },
    firma_zewnetrzna: { 7: 349, 30: 999, 90: 2199 },
  },
  sponsored_carousel: {
    salon_w_aplikacji: { 7: 89, 30: 229, 90: 549 },
    firma_zewnetrzna: { 7: 149, 30: 399, 90: 899 },
  },
};

test('catalog retains the five approved packages and all listed prices', () => {
  assert.equal(catalog.ADVERTISING_PACKAGES.length, 5);
  for (const [packageId, clientPrices] of Object.entries(expectedPrices)) {
    const item = catalog.getAdvertisingPackage(packageId);
    assert.ok(item, `missing package: ${packageId}`);
    assert.deepEqual(item.pricesNetPln, clientPrices, `price regression in ${packageId}`);
  }
});

test('only the approved client types and 7/30/90 day durations are listed', () => {
  assert.deepEqual(catalog.ADVERTISING_DURATIONS, [7, 30, 90]);
  assert.deepEqual(
    catalog.ADVERTISING_CLIENT_TYPES.map(({ id }) => id),
    ['salon_w_aplikacji', 'firma_zewnetrzna'],
  );
});

test('price helper returns catalog values and rejects unknown packages', () => {
  assert.equal(catalog.getAdvertisingNetPrice('listing_highlight', 'salon_w_aplikacji', 7), 49);
  assert.equal(catalog.getAdvertisingNetPrice('home_screen_banner', 'firma_zewnetrzna', 90), 2199);
  assert.equal(catalog.getAdvertisingPackage('not-a-package'), undefined);
  assert.throws(
    () => catalog.getAdvertisingNetPrice('not-a-package', 'salon_w_aplikacji', 7),
    /Nieznany pakiet reklamowy/,
  );
});

test('price formatting uses Polish złoty currency formatting', () => {
  assert.match(catalog.formatNetPrice(49), /49,00/);
  assert.match(catalog.formatNetPrice(49), /zł/);
});
