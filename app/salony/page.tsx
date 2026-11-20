'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Salon {
  id: string;
  salon_name: string;
  slug: string;
}

interface SponsoredAd {
  id: string;
  title: string;
  body: string | null;
  destinationUrl: string;
}

export default function SalonyPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    fetch('/api/salons')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setSalons((data.salons as Salon[]) || []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    // Ads are optional: a failed ad request must never hide the salon catalogue.
    fetch('/api/advertising/public', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : { ads: [] })
      .then((data) => {
        if (active) setAds(Array.isArray(data.ads) ? data.ads : []);
      })
      .catch(() => {
        if (active) setAds([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = salons.filter(s =>
    s.salon_name.toLowerCase().includes(search.toLowerCase())
  );

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

        {ads.length > 0 && (
          <section aria-label="Reklamy sponsorowane" className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">Sponsorowane</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ads.map((ad) => (
                <a
                  key={ad.id}
                  href={ad.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block rounded-2xl border border-amber-500/40 bg-zinc-950 p-6 transition-colors hover:border-amber-400"
                >
                  <span className="inline-flex rounded-full border border-amber-500/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">Reklama</span>
                  <h2 className="mt-3 text-lg font-bold text-white">{ad.title}</h2>
                  {ad.body && <p className="mt-2 text-sm leading-6 text-zinc-400">{ad.body}</p>}
                  <span className="mt-4 inline-block text-sm font-semibold text-amber-300">Sprawdź ofertę →</span>
                </a>
              ))}
            </div>
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
