'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
type SalonLookupStatus = 'loading' | 'found' | 'missing' | 'signed_out' | 'error' | 'not_applicable';

export default function ReklamyPage() {
  const [clientType, setClientType] = useState<AdvertisingClientType>('salon_w_aplikacji');
  const [duration, setDuration] = useState<AdvertisingDurationDays>(30);
  const [placement, setPlacement] = useState<PlacementFilter>('all');
  const [selectedPackage, setSelectedPackage] = useState<string>('listing_highlight');
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [salonLookupStatus, setSalonLookupStatus] = useState<SalonLookupStatus>('loading');
  const [linkedSalonName, setLinkedSalonName] = useState('');
  const checkoutIdempotencyKey = useRef<string | null>(null);
  const testCheckoutEnabled = process.env.NEXT_PUBLIC_ADVERTISING_TEST_CHECKOUT === 'true';

  const packages = useMemo(
    () => ADVERTISING_PACKAGES.filter((item) => placement === 'all' || item.placement === placement),
    [placement],
  );
  const selected = ADVERTISING_PACKAGES.find((item) => item.id === selectedPackage);
  const selectedPrice = selected?.pricesNetPln[clientType][duration];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_return') === '1') {
      setPaymentNotice('Wróciłeś z testowej sesji Stripe. Płatność potwierdza wyłącznie webhook — odświeżenie tej strony nie oznacza, że zamówienie zostało opłacone.');
    } else if (params.get('payment_cancelled') === '1') {
      setPaymentNotice('Płatność została anulowana. Zamówienie nie uruchamia emisji reklamy.');
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLinkedSalon() {
      if (clientType !== 'salon_w_aplikacji') {
        setSalonLookupStatus('not_applicable');
        setLinkedSalonName('');
        return;
      }

      setSalonLookupStatus('loading');
      setLinkedSalonName('');

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;

        if (sessionError) {
          setSalonLookupStatus('error');
          return;
        }

        if (!session?.user) {
          setSalonLookupStatus('signed_out');
          return;
        }

        const { data: salon, error: salonError } = await supabase
          .from('salons')
          .select('salon_name')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!active) return;

        if (salonError) {
          console.error('LUMAR advertising salon lookup failed:', salonError);
          setSalonLookupStatus('error');
          return;
        }

        if (!salon?.salon_name) {
          setSalonLookupStatus('missing');
          return;
        }

        setLinkedSalonName(salon.salon_name);
        setSalonLookupStatus('found');
      } catch (error) {
        console.error('LUMAR advertising salon lookup failed:', error);
        if (active) setSalonLookupStatus('error');
      }
    }

    void loadLinkedSalon();
    return () => {
      active = false;
    };
  }, [clientType]);

  async function startTestCheckout() {
    setCheckoutMessage('');
    if (!testCheckoutEnabled) return;
    if (!selected) return;
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Zaloguj się do LUMAR, aby zamówić reklamę.');

      let salonId: string | null = null;
      if (clientType === 'salon_w_aplikacji') {
        const { data: salon, error: salonError } = await supabase
          .from('salons')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (salonError) throw new Error('Nie udało się pobrać salonu przypisanego do konta.');
        if (!salon?.id) throw new Error('Na tym koncie nie znaleziono salonu.');
        salonId = salon.id;
      }

      const response = await fetch('/api/advertising/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
          'Idempotency-Key': checkoutIdempotencyKey.current ?? (checkoutIdempotencyKey.current = crypto.randomUUID()),
        },
        body: JSON.stringify({
          packageId: selected.id,
          clientType,
          durationDays: duration,
          salonId,
          title: adTitle,
          description: adDescription,
          destinationUrl,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Nie udało się rozpocząć płatności testowej.');
      if (typeof result.checkoutUrl !== 'string') throw new Error('Stripe nie zwrócił adresu płatności.');
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd.');
      setCheckoutLoading(false);
    }
  }

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
          <nav className="flex items-center gap-4">
            <Link href="/reklamy/zamowienia" className="text-sm text-zinc-300 transition hover:text-amber-300">Moje zamówienia</Link>
            <Link href="/salony" className="text-sm text-zinc-300 transition hover:text-amber-300">Lista salonów</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">Reklama w LUMAR</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
          Wybierz sposób, w jaki klienci zobaczą Twoją firmę.
        </h1>
        {paymentNotice && <p role="status" className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">{paymentNotice}</p>}
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
          Wybierz pakiet, typ klienta i czas emisji. Ceny katalogowe są podane netto w PLN. Dostępna będzie wyłącznie płatność testowa Stripe w środowisku Preview; płatności produkcyjne pozostają wyłączone.
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
              {clientType === 'salon_w_aplikacji' && (
                <div role="status" className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm">
                  {salonLookupStatus === 'loading' && <span className="text-zinc-400">Sprawdzam salon przypisany do zalogowanego konta…</span>}
                  {salonLookupStatus === 'found' && <span className="text-emerald-300">Salon przypisany do konta: <strong>{linkedSalonName}</strong></span>}
                  {salonLookupStatus === 'missing' && <span className="text-amber-200">Na tym koncie nie znaleziono salonu. Sprawdź, czy logujesz się na właściwe konto.</span>}
                  {salonLookupStatus === 'signed_out' && <span className="text-amber-200">Nie jesteś zalogowany w tej wersji Preview. Zaloguj się najpierw w panelu salonu, używając tego samego adresu strony.</span>}
                  {salonLookupStatus === 'error' && <span className="text-red-300">Nie udało się sprawdzić przypisanego salonu. Odśwież stronę i spróbuj ponownie.</span>}
                </div>
              )}
              <p className="mt-2 text-sm text-zinc-400">Kwota katalogowa. Test nie uruchamia emisji reklamy — po opłaceniu kampania trafia do moderacji.</p>
            </div>
            <div className="sm:text-right">
              <p className="text-3xl font-black text-amber-300">{selectedPrice === undefined ? '—' : formatNetPrice(selectedPrice)}</p>
              <span className="mt-2 inline-flex rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-200">TRYB TESTOWY</span>
            </div>
          </div>
          <div className="mt-5 grid gap-4 border-t border-zinc-800 pt-5">
            <label className="grid gap-2 text-sm font-semibold text-zinc-200">
              Tytuł reklamy
              <input value={adTitle} onChange={(event) => { checkoutIdempotencyKey.current = null; setAdTitle(event.target.value); }} maxLength={120} required placeholder="Np. Nowa kolekcja zabiegów" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 font-normal text-white outline-none focus:border-amber-400" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-zinc-200">
              Krótki opis (opcjonalnie)
              <textarea value={adDescription} onChange={(event) => { checkoutIdempotencyKey.current = null; setAdDescription(event.target.value); }} maxLength={500} rows={3} placeholder="Napisz krótko, co chcesz promować." className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 font-normal text-white outline-none focus:border-amber-400" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-zinc-200">
              Adres strony, do której prowadzi reklama (HTTPS)
              <input value={destinationUrl} onChange={(event) => { checkoutIdempotencyKey.current = null; setDestinationUrl(event.target.value); }} type="url" maxLength={2048} required placeholder="https://twoja-strona.pl" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 font-normal text-white outline-none focus:border-amber-400" />
            </label>
            {checkoutMessage && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{checkoutMessage}</p>}
            <button
              type="button"
              onClick={startTestCheckout}
              disabled={!testCheckoutEnabled || checkoutLoading || !selected || adTitle.trim().length < 3 || !destinationUrl.trim()}
              className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
            >
              {checkoutLoading ? 'Przygotowuję płatność…' : testCheckoutEnabled ? 'Przejdź do testowej płatności Stripe' : 'Testowa płatność — jeszcze nieaktywna'}
            </button>
            <p className="text-xs leading-5 text-zinc-400">
              {testCheckoutEnabled
                ? 'Piaskownica Stripe. Używane są wyłącznie testowe klucze. Płatność nie uruchamia reklamy automatycznie.'
                : 'Przycisk pozostaje zablokowany, dopóki administrator nie włączy flagi testowej w środowisku Preview i nie przygotuje bazy oraz webhooka.'}
            </p>
          </div>
          <p className="mt-4 border-t border-zinc-800 pt-4 text-sm leading-6 text-zinc-400">
            Po potwierdzeniu płatności przez podpisany webhook kampania trafia do moderacji. Nie jest publikowana automatycznie. Produkcyjne płatności pozostają wyłączone do osobnej decyzji po weryfikacji zasad podatkowych i rozliczeniowych.
          </p>
        </aside>
      </section>
    </main>
  );
}
