'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface Service { id: string; name: string; duration_minutes: number; price?: number; }
interface Salon { id: string; salon_name: string; slug: string; }
interface BookedTime { start: string; end: string; }

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function generateSlots(openTime: string, closeTime: string, durationMinutes: number, bookedTimes: BookedTime[]): string[] {
  const slots: string[] = [];
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  let current = open;
  while (current + durationMinutes <= close) {
    const h = Math.floor(current / 60).toString().padStart(2, '0');
    const m = (current % 60).toString().padStart(2, '0');
    const slot = `${h}:${m}`;
    const slotEnd = current + durationMinutes;
    const blocked = bookedTimes.some(({ start, end }) => {
      return current < toMinutes(end) && slotEnd > toMinutes(start);
    });
    if (!blocked) slots.push(slot);
    current += 30;
  }
  return slots;
}

export default function SalonSlugPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [date, setDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isDayOff, setIsDayOff] = useState(false);
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function init() {
      // Szukaj po slug
      const { data: salonData, error } = await supabase
        .from('salons')
        .select('id, salon_name, slug')
        .eq('slug', slug)
        .single();

      if (error || !salonData) { setNotFound(true); setLoadingInit(false); return; }
      setSalon(salonData);

      const { data: svcs } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('salon_id', salonData.id)
        .order('name');

      const list = svcs || [];
      setServices(list);
      if (list.length > 0) setSelectedServiceId(String(list[0].id));
      setLoadingInit(false);
    }
    init();
  }, [slug]);

  useEffect(() => {
    if (!date || !salon?.id) { setAvailableSlots([]); setSelectedTime(''); setIsDayOff(false); return; }
    setLoadingSlots(true); setSelectedTime(''); setIsDayOff(false);

    fetch(`/api/appointments?salonId=${salon.id}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.isDayOff) { setIsDayOff(true); setAvailableSlots([]); return; }
        const bookedTimes: BookedTime[] = data.bookedTimes || [];
        const openTime = data.openTime || '09:00';
        const closeTime = data.closeTime || '18:00';
        const selectedService = services.find((s) => String(s.id) === selectedServiceId);
        const duration = selectedService?.duration_minutes || 60;
        const free = generateSlots(openTime, closeTime, duration, bookedTimes);
        setAvailableSlots(free);
        if (free.length > 0) setSelectedTime(free[0]);
      })
      .catch(console.error)
      .finally(() => setLoadingSlots(false));
  }, [date, salon?.id, selectedServiceId, services]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) { setMessage({ type: 'error', text: 'Wybierz godzinę.' }); return; }
    setLoading(true); setMessage(null);

    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time: selectedTime, clientName, email, phone, salonId: salon?.id, serviceId: selectedServiceId || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: '✅ Rezerwacja potwierdzona! Sprawdź email.' });
      setDate(''); setSelectedTime(''); setClientName(''); setEmail(''); setPhone('');
    } else {
      setMessage({ type: 'error', text: data.error || 'Błąd rezerwacji.' });
    }
    setLoading(false);
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];
  const selectedService = services.find((s) => String(s.id) === selectedServiceId);

  if (loadingInit) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-amber-400 animate-pulse font-bold">Ładowanie...</p>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4 space-y-4">
      <p className="text-6xl">🔍</p>
      <h1 className="text-2xl font-bold text-white">Salon nie istnieje</h1>
      <p className="text-zinc-400 text-sm">Link jest nieprawidłowy lub salon został usunięty.</p>
      <Link href="/" className="text-amber-400 hover:underline text-sm">← Wróć do strony głównej</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-amber-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(217,119,6,0.15)] space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-amber-400">{salon?.salon_name}</h1>
          <p className="text-zinc-500 text-sm">Zarezerwuj wizytę online</p>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-4xl">🕐</p>
            <p className="text-zinc-400 text-sm">Salon przygotowuje ofertę.<br />Wróć wkrótce.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">1. Wybierz usługę</label>
              <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 rounded-lg px-4 py-3 text-sm outline-none">
                {services.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}{s.price ? ` — ${s.price} PLN` : ''} ({s.duration_minutes} min)
                  </option>
                ))}
              </select>
              {selectedService && (
                <p className="text-xs text-zinc-500 mt-1">⏱ {selectedService.duration_minutes} min{selectedService.price ? ` · 💰 ${selectedService.price} PLN` : ''}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">2. Wybierz dzień</label>
              <input type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 rounded-lg px-4 py-3 text-sm outline-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">3. Wybierz godzinę</label>
              {!date ? <p className="text-xs text-zinc-500">Najpierw wybierz dzień.</p>
                : loadingSlots ? <p className="text-xs text-zinc-400 animate-pulse">Sprawdzam dostępność...</p>
                : isDayOff ? <p className="text-xs text-red-400">Ten dzień jest wolny. Wybierz inny termin.</p>
                : availableSlots.length === 0 ? <p className="text-xs text-red-400">Brak wolnych terminów. Wybierz inny dzień.</p>
                : (
                  <div className="grid grid-cols-5 gap-2">
                    {availableSlots.map((slot) => (
                      <button key={slot} type="button" onClick={() => setSelectedTime(slot)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all border ${selectedTime === slot ? 'bg-amber-500 text-black border-amber-400' : 'bg-zinc-900 text-amber-200 border-amber-500/20 hover:border-amber-400'}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">4. Twoje dane</label>
              <input type="text" placeholder="Imię i Nazwisko" required value={clientName} onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none" />
              <input type="email" placeholder="Adres E-mail" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none" />
              <input type="tel" placeholder="Numer Telefonu" required value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none" />
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-xs text-center font-medium border ${message.type === 'success' ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-red-950/40 border-red-500/50 text-red-400'}`}>
                {message.text}
              </div>
            )}

            <button type="submit" disabled={loading || !selectedTime}
              className="w-full mt-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold py-3.5 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Rezerwowanie...' : selectedTime ? `Potwierdź — ${selectedTime}` : 'Wybierz godzinę'}
            </button>
          </form>
        )}

        <div className="pt-2 text-center border-t border-amber-500/10">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            LUMAR · Chcesz taką aplikację dla swojego salonu? →
          </Link>
        </div>
      </div>
    </div>
  );
}
