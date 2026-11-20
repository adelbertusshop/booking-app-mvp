'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type HomeAd = {
  id: string;
  title: string;
  body: string | null;
  destinationUrl: string;
};

export default function Home() {
  const [ads, setAds] = useState<HomeAd[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/advertising/public?slot=home_screen_banner', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { ads: [] })
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* HERO */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-8">

          <div className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full">
            LUMAR · System rezerwacji dla salonów
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight">
            Twój salon.<br />
            <span className="text-amber-400">Twoje rezerwacje.</span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-lg mx-auto">
            Zarejestruj swój salon w 60 sekund. Dostaniesz własny link do rezerwacji dla klientów. Zero prowizji. Zero abonamentu na start.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/admin"
              className="bg-amber-500 hover:bg-amber-400 text-black font-black py-4 px-8 rounded-xl text-lg transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 hover:scale-105"
            >
              Zarejestruj Salon za darmo →
            </Link>
            <Link
              href="/admin"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-200"
            >
              Mam już konto — Zaloguj się
            </Link>
            <Link
              href="/salony"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold py-4 px-8 rounded-xl text-lg transition-all duration-200"
            >
              🔍 Znajdź salon
            </Link>
          </div>
        </div>
      </main>

      {ads.length > 0 && (
        <section aria-label="Reklamy sponsorowane" className="border-t border-zinc-900 px-4 py-8">
          <div className="mx-auto grid max-w-5xl gap-4">
            {ads.map((ad) => (
              <a
                key={ad.id}
                href={ad.destinationUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="block rounded-2xl border border-amber-500/40 bg-zinc-950 p-6 text-left transition-colors hover:border-amber-400"
              >
                <span className="inline-flex rounded-full border border-amber-500/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">Reklama</span>
                <h2 className="mt-3 text-xl font-bold text-white">{ad.title}</h2>
                {ad.body && <p className="mt-2 text-sm leading-6 text-zinc-400">{ad.body}</p>}
                <span className="mt-4 inline-block text-sm font-semibold text-amber-300">Sprawdź ofertę →</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* FEATURES */}
      <section className="border-t border-zinc-900 py-16 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: '⚡', title: 'Szybka rejestracja', desc: 'Konto i panel gotowy w minutę. Dodajesz usługi, ceny i godziny — od razu możesz działać.' },
            { icon: '🔗', title: 'Twój własny link', desc: 'Każdy salon dostaje unikalny link. Wrzucasz go na Instagram, WhatsApp, stronę — klienci rezerwują sami.' },
            { icon: '📧', title: 'Powiadomienia email', desc: 'Ty i klient dostajecie email przy każdej rezerwacji i odwołaniu. Zero ręcznego potwierdzania.' },
          ].map((f) => (
            <div key={f.title} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="text-lg font-bold text-amber-400">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-900 py-16 px-4 text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl font-black text-white">Gotowy?</h2>
          <p className="text-zinc-400">Zarejestruj salon i zacznij przyjmować rezerwacje online już dziś.</p>
          <Link
            href="/admin"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-black font-black py-4 px-10 rounded-xl text-lg transition-all duration-200 hover:scale-105"
          >
            Zacznij teraz — to nic nie kosztuje
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-900 py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-3 text-center">
          <p className="text-amber-400 font-black tracking-wider text-sm">LUMAR</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <a href="/regulamin" className="hover:text-amber-400 transition-colors">Regulamin</a>
            <a href="/polityka-prywatnosci" className="hover:text-amber-400 transition-colors">Polityka prywatności</a>
            <a href="/kontakt" className="hover:text-amber-400 transition-colors">Kontakt</a>
            <a href="/salony" className="hover:text-amber-400 transition-colors">Katalog salonów</a>
          </div>
          <p className="text-xs text-zinc-700">© 2026 LUMAR · Wojciech Jarosz · wojciechjarosz41@gmail.com</p>
        </div>
      </footer>
    </div>
  );
}
