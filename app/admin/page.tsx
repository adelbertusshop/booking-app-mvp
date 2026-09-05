'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function HomePage() {
  const [service, setService] = useState('Fryzjer / Fryzjerka');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!date || !name || !email || !phone) {
      setMessage({ type: 'error', text: 'Proszę wypełnić wszystkie pola.' });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('appointments').insert([
        {
          service_name: service,
          date: date,
          time: time,
          client_name: name,
          email: email,
          phone: phone,
        },
      ]);

      if (error) {
        throw error;
      }

      setMessage({ type: 'success', text: 'Rezerwacja została pomyślnie złożona!' });
      setName('');
      setEmail('');
      setPhone('');
      setDate('');
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Wystąpił błąd podczas zapisywania rezerwacji.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-amber-500/30 p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl">
        <h1 className="text-3xl font-extrabold text-amber-400 text-center tracking-wide">
          Zarezerwuj Wizytę
        </h1>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm font-semibold border ${
              message.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-500 text-emerald-400'
                : 'bg-red-950/50 border-red-500 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase font-bold text-amber-400 mb-1">
              1. Wybierz usługę
            </label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 focus:outline-none focus:border-amber-400"
            >
              <option value="Fryzjer / Fryzjerka">Fryzjer / Fryzjerka</option>
              <option value="Barber">Barber</option>
              <option value="Strzyżenie Męskie">Strzyżenie Męskie</option>
              <option value="Broda">Broda</option>
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-amber-400 mb-1">
              2. Wybierz dzień
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-amber-400 mb-1">
              3. Wybierz godzinę
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 focus:outline-none focus:border-amber-400"
            >
              <option value="10:00">10:00</option>
              <option value="11:00">11:00</option>
              <option value="12:00">12:00</option>
              <option value="13:00">13:00</option>
              <option value="14:00">14:00</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs uppercase font-bold text-amber-400">
              4. Twoje dane
            </label>
            <input
              type="text"
              placeholder="Imię i Nazwisko"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 focus:outline-none focus:border-amber-400"
            />
            <input
              type="email"
              placeholder="Adres E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 focus:outline-none focus:border-amber-400"
            />
            <input
              type="tel"
              placeholder="Numer Telefonu"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-lg transition-colors shadow-lg mt-2 disabled:opacity-50"
          >
            {loading ? 'Zapisywanie...' : 'Potwierdź Rezerwację'}
          </button>
        </form>

        <div className="pt-4 text-center border-t border-amber-500/10">
          <a
            href="/admin"
            className="text-xs uppercase font-semibold text-amber-200/60 hover:text-amber-400 transition-colors tracking-widest cursor-pointer inline-block py-1"
          >
            PANEL ADMINISTRATORA
          </a>
        </div>
      </div>
    </main>
  );
}