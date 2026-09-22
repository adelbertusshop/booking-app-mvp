'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface Salon {
  id: string;
  salon_name: string;
  slug: string;
}

export default function SalonyPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('salons')
      .select('id, salon_name, slug')
      .not('slug', 'is', null)
      .order('salon_name', { ascending: true })
      .then(({ data }) => {
        setSalons((data as Salon[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = salons.filter(s =>
    s.salon_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-900 py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-amber-400 font-black text-xl">BookingApp</Link>
          <Link href="/admin" className="text-xs text-zinc-400 hover:text-amber-400 transition-colors">
            Panel właściciela →
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-white">Znajdź salon</h1>
          <p className="text-zinc-400">Zarezerwuj wizytę online w kilka sekund.</p>
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
                      booking-app-mvp.vercel.app/salon/{salon.slug}
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

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        <Link href="/" className="hover:text-zinc-400 transition-colors">← Wróć do strony głównej</Link>
        {' · '}
        <Link href="/admin" className="hover:text-zinc-400 transition-colors">Zarejestruj swój salon</Link>
      </footer>
    </div>
  );
}
