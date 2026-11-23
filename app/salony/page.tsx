'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Salon {
  id: string;
  salon_name: string;
  slug: string;
}

interface PublicAd {
  id: string;
  title: string;
  body: string | null;
  destinationUrl: string;
  salonId?: string | null;
  imageUrl?: string | null;
}

export default function SalonyPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [ads, setAds] = useState<PublicAd[]>([]);
  const [externalFeaturedAds, setExternalFeaturedAds] = useState<PublicAd[]>([]);
  const [inAppBanners, setInAppBanners] = useState<PublicAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/salons')
      .then((res) => res.json())
      .then((data) => {
        setSalons((data.salons as Salon[]) || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/advertising/public?slot=salon_listing')
      .then((response) => (response.ok ? response.json() : { ads: [] }))
      .then((data) => {
        if (!cancelled) {
          const safeAds = Array.isArray(data.ads)
            ? data.ads.filter((ad: PublicAd) => ad && typeof ad.id === 'string' && typeof ad.title === 'string' && typeof ad.destinationUrl === 'string')
            : [];
          setAds(safeAds);
          safeAds.forEach((ad: PublicAd) => void fetch('/api/advertising/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: ad.id, eventType: 'impression', placement: 'salon_catalog' }),
          }).catch(() => undefined));
        }
      })
      .catch(() => {
        if (!cancelled) setAds([]);
      });

    fetch('/api/advertising/public?slot=featured_profile')
      .then((response) => response.ok ? response.json() : { ads: [] })
      .then((data) => {
        if (!cancelled) {
          const safeFeaturedAds: PublicAd[] = Array.isArray(data.ads) ? data.ads : [];
          setExternalFeaturedAds(safeFeaturedAds);
          safeFeaturedAds.forEach((ad) => void fetch('/api/advertising/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: ad.id, eventType: 'impression', placement: 'salon_catalog' }),
          }).catch(() => undefined));
        }
      })
      .catch(() => { if (!cancelled) setExternalFeaturedAds([]); });

    fetch('/api/advertising/public?slot=in_app_banner')
      .then((response) => response.ok ? response.json() : { ads: [] })
      .then((data) => {
        if (!cancelled) {
          const safeBanners: PublicAd[] = Array.isArray(data.ads) ? data.ads : [];
          setInAppBanners(safeBanners);
          safeBanners.forEach((ad) => void fetch('/api/advertising/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: ad.id, eventType: 'impression', placement: 'lumar_pages' }),
          }).catch(() => undefined));
        }
      })
      .catch(() => { if (!cancelled) setInAppBanners([]); });

    return () => { cancelled = true; };
  }, []);

  const filtered = salons
    .filter((s) => s.salon_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(ads.some((ad) => ad.salonId === b.id)) - Number(ads.some((ad) => ad.salonId === a.id)));
  const externalSponsoredAds = [
    ...ads.filter((ad) => !ad.salonId),
    ...externalFeaturedAds,
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-900 py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-amber-400 font-black text-xl tracking-wider">LUMAR</Link>
          <Link href="/admin" className="text-xs text-zinc-400 hover:text-amber-400 transition-colors">
            Panel właściciela →
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-white">Znajdź salon</h1>
          <p className="text-zinc-400">Zarezerwuj wizytę online w kilka sekund.<br /><span className="text-xs text-zinc-600">System rezerwacji dla salonów</span></p>
        </div>

        {/* Wyszukiwarka */}
        <div className="max-w-md mx-auto">
          <input
            type="text"
            placeholder="🔍 Szukaj salonu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-amber-500/30 focus:border-amber-400 text-white placeholder-zinc-500 rounded-xl px-5 py-3 text-sm outline-none transition-all"
          />
        </div>

        {/* Reklamy sponsorowane */}
        {!loading && externalSponsoredAds.length > 0 && (
          <section className="space-y-3" aria-label="Reklamy sponsorowane">
            {externalSponsoredAds.map((ad) => (
              <article key={ad.id} className="overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-950 p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {ad.imageUrl && <img src={ad.imageUrl} alt="" className="max-h-32 w-full rounded-xl object-cover sm:max-w-xs" />}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Reklama</p>
                    <h2 className="text-lg font-bold text-white">{ad.title}</h2>
                    {ad.body && <p className="text-sm text-zinc-400">{ad.body}</p>}
                  </div>
                  <a
                    href={ad.destinationUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    onClick={() => void fetch('/api/advertising/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId: ad.id, eventType: 'click', placement: 'salon_catalog' }) })}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-amber-400"
                  >
                    Sprawdź ofertę →
                  </a>
                </div>
              </article>
            ))}
          </section>
        )}
        {inAppBanners.length > 0 && (
          <section className="grid gap-3" aria-label="Banery reklamowe">
            {inAppBanners.map((ad) => (
              <article key={ad.id} className="overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-950 p-4">
                {ad.imageUrl && <img src={ad.imageUrl} alt="" className="mb-3 max-h-44 w-full rounded-xl object-cover" />}
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Reklama</p>
                <h2 className="mt-1 text-lg font-bold">{ad.title}</h2>
                {ad.body && <p className="mt-1 text-sm text-zinc-400">{ad.body}</p>}
                <a href={ad.destinationUrl} target="_blank" rel="noopener noreferrer sponsored"
                  onClick={() => void fetch('/api/advertising/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId: ad.id, eventType: 'click', placement: 'lumar_pages' }) })}
                  className="mt-3 inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black">Sprawdź ofertę →</a>
              </article>
            ))}
          </section>
        )}

        {/* Lista salonów */}
        {loading ? (
          <div className="text-center py-16">
            <p className="text-amber-400 animate-pulse">Ładowanie salonów...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">🔍</p>
            <p className="text-zinc-400 text-sm">
              {search ? `Brak wyników dla "${search}"` : 'Brak zarejestrowanych salonów.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((salon) => (
              <div key={salon.id} className="bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 rounded-2xl p-6 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {ads.find((ad) => ad.salonId === salon.id)?.imageUrl && (
                      <img src={ads.find((ad) => ad.salonId === salon.id)?.imageUrl ?? ''} alt="" className="mb-3 h-28 w-full rounded-xl object-cover" />
                    )}
                    {ads.some((ad) => ad.salonId === salon.id) && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Wyróżniony · Reklama</span>
                    )}
                    <h2 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                      {salon.salon_name}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      lumaria-app.pl/salon/{salon.slug}
                    </p>
                  </div>
                  <span className="text-2xl">💇</span>
                </div>
                <Link
                  href={`/salon/${salon.slug}`}
                  onClick={() => {
                    const promoted = ads.find((ad) => ad.salonId === salon.id);
                    if (promoted) void fetch('/api/advertising/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId: promoted.id, eventType: 'click', placement: 'salon_catalog' }) });
                  }}
                  className="mt-4 block w-full text-center bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-xl text-sm transition-all"
                >
                  Zarezerwuj wizytę →
                </Link>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-zinc-600 pt-4">
          {filtered.length > 0 && `${filtered.length} salon${filtered.length === 1 ? '' : filtered.length < 5 ? 'e' : 'ów'} w systemie`}
        </p>
      </main>

      <footer className="border-t border-zinc-900 py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-3 text-center">
          <p className="text-amber-400 font-black tracking-wider text-sm">LUMAR</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <a href="/regulamin" className="hover:text-amber-400 transition-colors">Regulamin</a>
            <a href="/polityka-prywatnosci" className="hover:text-amber-400 transition-colors">Polityka prywatności</a>
            <a href="/kontakt" className="hover:text-amber-400 transition-colors">Kontakt</a>
            <a href="/admin" className="hover:text-amber-400 transition-colors">Zarejestruj swój salon</a>
          </div>
          <p className="text-xs text-zinc-700">© 2026 LUMAR · Wojciech Jarosz · wojciechjarosz41@gmail.com</p>
        </div>
      </footer>
    </div>
  );
}
