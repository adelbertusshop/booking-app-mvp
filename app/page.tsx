'use client';

import { useState } from 'react';

export default function Home() {
  const [formData, setFormData] = useState({
    serviceName: 'Konsultacja podstawowa',
    date: '',
    time: '09:00',
    clientName: '',
    email: '',
    phone: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Rezerwacja została pomyślnie złożona!' });
        setFormData({
          serviceName: 'Konsultacja podstawowa',
          date: '',
          time: '09:00',
          clientName: '',
          email: '',
          phone: '',
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Wystąpił błąd podczas rezerwacji.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-amber-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(217,119,6,0.15)] space-y-6">
        <h1 className="text-3xl font-bold text-center text-amber-400 tracking-wide">
          Zarezerwuj Wizytę
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Wybierz usługę */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              1. Wybierz usługę
            </label>
            <select
              value={formData.serviceName}
              onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            >
              <option value="Konsultacja podstawowa">Konsultacja podstawowa</option>
            </select>
          </div>

          {/* 2. Wybierz dzień */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              2. Wybierz dzień
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            />
          </div>

          {/* 3. Wybierz godzinę */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              3. Wybierz godzinę
            </label>
            <select
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            >
              <option value="09:00">09:00</option>
              <option value="10:00">10:00</option>
              <option value="11:00">11:00</option>
              <option value="12:00">12:00</option>
              <option value="13:00">13:00</option>
              <option value="14:00">14:00</option>
              <option value="15:00">15:00</option>
            </select>
          </div>

          {/* 4. Twoje dane */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
              4. Twoje dane
            </label>
            <input
              type="text"
              placeholder="Imię i Nazwisko"
              required
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            />
            <input
              type="email"
              placeholder="Adres E-mail"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            />
            <input
              type="tel"
              placeholder="Numer Telefonu"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg text-xs text-center font-medium border ${
                message.type === 'success'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-red-950/40 border-red-500/50 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold py-3.5 rounded-lg text-sm transition-all duration-200 shadow-md hover:shadow-amber-500/20 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Rezerwowanie...' : 'Potwierdź Rezerwację'}
          </button>
        </form>
      </div>
    </div>
  );
}