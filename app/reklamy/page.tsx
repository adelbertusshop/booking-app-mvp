'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ADVERTISING_CLIENT_TYPES,
  ADVERTISING_DURATIONS,
  ADVERTISING_PACKAGES,
  type AdvertisingClientType,
  type AdvertisingDurationDays,
  type AdvertisingPlacement,
  formatNetPrice,
} from '@/lib/advertising/catalog';

type PlacementFilter = 'all' | AdvertisingPlacement;

export default function ReklamyPage() {
  const [clientType, setClientType] = useState<AdvertisingClientType>('salon_w_aplikacji');
  const [duration, setDuration] = useState<AdvertisingDurationDays>(30);
  const [placement, setPlacement] = useState<PlacementFilter>('all');
  const [selectedPackage, setSelectedPackage] = useState<string>('listing_highlight');

  const packages = useMemo(
    () => ADVERTISING_PACKAGES.filter((item) => placement === 'all' || item.placement === placement),
    [placement],
  );
  const selected = ADVERTISING_PACKAGES.find((item) => item.id === selectedPackage);
  const selectedPrice = selected?.pricesNetPln[clientType][duration];

  function choosePlacement(next: PlacementFilter) {
    setPlacement(next);
    if (next !== 'all') {
      const firstMatch = ADVERTISING_PACKAGES.find((item) => item.placement === next);
      if (firstMatch) setSelectedPackage(firstMatch.id);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-xl font-black tracking-widest text-amber-400">LUMAR</Link>
          <Link href="/salony" className="text-sm text-zinc-300 transition hover:text-amber-300">Lista salonów</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">Reklama w LUMAR</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
          Wybierz sposób, w jaki klienci zobaczą Twoją firmę.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
          Wybierz pakiet, typ klienta i czas emisji. Ceny są podane netto w PLN; VAT zostanie doliczony zgodnie z konfiguracją systemu.
        </p>

        <div className="mt-8 grid gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-zinc-200">Kto zamawia reklamę?</legend>
            <div className="grid gap-2">
              {ADVERTISING_CLIENT_TYPES.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setClientType(client.id)}
                  aria-pressed={clientType === client.id}
                  className={`rounded-xl border p-3 text-left transition ${clientType === client.id ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'}`}
                >
                  <span className="block font-semibold">{client.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-zinc-400">{client.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-zinc-200">Czas emisji</legend>
            <div className="grid grid-cols-3 gap-2">
              {ADVERTISING_DURATIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDuration(days)}
                  aria-pressed={duration === days}
                  className={`rounded-xl border px-2 py-4 text-center transition ${duration === days ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'}`}
                >
                  <span className="block text-xl font-bold">{days}</span>
                  <span className="text-sm text-zinc-400">dni</span>
                </button>
              ))}
            </div>
            <label htmlFor="placement" className="mb-2 mt-6 block text-sm font-semibold text-zinc-200">Miejsce emisji</label>
            <select
              id="placement"
              value={placement}
              onChange={(event) => choosePlacement(event.target.value as PlacementFilter)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-amber-400"
            >
              <option value="all">Wszystkie pakiety</option>
              <option value="salon_catalog">Lista salonów / firm</option>
              <option value="lumar_pages">Banery i treści w aplikacji</option>
            </select>
          </fieldset>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((item) => {
            const price = item.pricesNetPln[clientType][duration];
            const isSelected = selectedPackage === item.id;
            return (
              <article key={item.id} className={`flex flex-col rounded-2xl border p-5 transition ${isSelected ? 'border-amber-400 bg-amber-400/[0.06] ring-1 ring-amber-400/30' : 'border-zinc-800 bg-zinc-900/60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{item.placementLabel}</span>
                  {item.id === 'featured_profile' && <span className="rounded-full bg-amber-400 px-2 py-1 text-xs font-bold text-black">Polecany</span>}
                </div>
                <h2 className="mt-4 text-xl font-bold leading-snug">{item.name}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-400">{item.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex gap-2"><span className="text-amber-400">✓</span><span>{feature}</span></li>
                  ))}
                </ul>
                <div className="mt-6 border-t border-zinc-800 pt-5">
                  <p className="text-sm text-zinc-400">{duration} dni emisji · cena netto</p>
                  <p className="mt-1 text-3xl font-black text-amber-300">{formatNetPrice(price)}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedPackage(item.id)}
                    aria-pressed={isSelected}
                    className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${isSelected ? 'bg-amber-400 text-black' : 'border border-zinc-700 text-white hover:border-amber-400 hover:text-amber-200'}`}
                  >
                    {isSelected ? 'Wybrany pakiet' : 'Wybierz pakiet'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-amber-300">Twoje podsumowanie</p>
              <h2 className="mt-1 text-xl font-bold">{selected?.name ?? 'Wybierz pakiet'}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {clientType === 'salon_w_aplikacji' ? 'Salon w LUMAR' : 'Firma zewnętrzna'} · {duration} dni
              </p>
              <p className="mt-2 text-sm text-zinc-400">Cena netto. Ostateczna kwota brutto zależy od konfiguracji VAT.</p>
            </div>
            <div className="sm:text-right">
              <p className="text-3xl font-black text-amber-300">{selectedPrice === undefined ? '—' : formatNetPrice(selectedPrice)}</p>
              <button
                type="button"
                disabled
                title="Zakup zostanie włączony po wdrożeniu i przetestowaniu płatności Stripe."
                className="mt-3 cursor-not-allowed rounded-xl bg-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300"
              >
                Zakup — płatności w przygotowaniu
              </button>
            </div>
          </div>
          <p className="mt-4 border-t border-zinc-800 pt-4 text-sm leading-6 text-zinc-400">
            Wybranie pakietu nie pobiera opłaty i nie uruchamia emisji. Reklama zacznie być wyświetlana dopiero po bezpiecznym potwierdzeniu płatności, akceptacji materiału reklamowego i ustaleniu daty startu.
          </p>
        </aside>
      </section>
    </main>
  );
}
