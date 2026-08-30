'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const SERVICES = [
  'Konsultacja podstawowa',
  'Usługa rozszerzona',
  'Wizyta kompleksowa'
];

const TIME_SLOTS = [
  '09:00', '10:00', '11:30', '13:00', '14:30', '16:00'
];

export default function Home() {
  const [selectedService, setSelectedService] = useState(SERVICES[0]);
  const [selectedDate, setSelectedDate] = useState('2026-08-25');
  const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[0]);
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName || !email) {
      setStatusMsg('Wypełnij imię i nazwisko oraz e-mail.');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg('');

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceName: selectedService,
          date: selectedDate,
          time: selectedTime,
          clientName: clientName,
          email: email,
          phone: phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Błąd podczas zapisywania rezerwacji.');
      }

      setStatusMsg('Rezerwacja została pomyślnie zapisana!');
    } catch (err: any) {
      setStatusMsg(err.message || 'Wystąpił błąd.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl space-y-6">
        <h1 className="text-2xl font-bold text-teal-400 text-center">Zarezerwuj Wizytę</h1>

        {statusMsg && (
          <div className="p-3 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-lg text-sm text-center">
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase font-bold text-slate-400 mb-2">1. Wybierz usługę</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {SERVICES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-slate-400 mb-2">2. Wybierz dzień</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-slate-400 mb-2">3. Wybierz godzinę</label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3 pt-2">
            <label className="block text-xs uppercase font-bold text-slate-400">4. Twoje dane</label>
            <input
              type="text"
              placeholder="Imię i Nazwisko"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-teal-500"
              required
            />
            <input
              type="email"
              placeholder="Adres E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-teal-500"
              required
            />
            <input
              type="tel"
              placeholder="Numer Telefonu"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-lg transition disabled:opacity-50"
          >
            {isSubmitting ? 'Wysyłanie...' : 'Potwierdź Rezerwację'}
          </button>
        </form>
      </div>
    </div>
  );
}