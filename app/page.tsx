'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Salon {
  id: string;
  salon_name?: string;
  name?: string;
  slug?: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price?: number;
}

interface BookedTime {
  start: string;
  end: string;
}

const ALL_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30',
  '17:00','17:30','18:00','18:30','19:00','19:30','20:00',
];

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function isSlotBlocked(slot: string, durationMin: number, bookedTimes: BookedTime[]): boolean {
  const slotStart = toMinutes(slot);
  const slotEnd = slotStart + durationMin;
  return bookedTimes.some(({ start, end }) => {
    const bStart = toMinutes(start);
    const bEnd = toMinutes(end);
    return slotStart < bEnd && slotEnd > bStart;
  });
}

export default function Home() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [selectedSalonId, setSelectedSalonId] = useState('');
  const [loadingSalons, setLoadingSalons] = useState(true);

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const [date, setDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pobierz salony
  useEffect(() => {
    async function fetchSalons() {
      try {
        const res = await fetch('/api/salons');
        if (res.ok) {
          const data = await res.json();
          const list = data.salons || data || [];
          setSalons(list);
          if (list.length > 0) setSelectedSalonId(list[0].id);
        }
      } catch (err) {
        console.error('Błąd pobierania salonów:', err);
      } finally {
        setLoadingSalons(false);
      }
    }
    fetchSalons();
  }, []);

  // Pobierz usługi gdy zmienia się salon
  useEffect(() => {
    if (!selectedSalonId) return;
    setLoadingServices(true);
    setSelectedServiceId('');
    setServices([]);

    fetch(`/api/services?salonId=${selectedSalonId}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.services || [];
        setServices(list);
        if (list.length > 0) setSelectedServiceId(String(list[0].id));
      })
      .catch(console.error)
      .finally(() => setLoadingServices(false));
  }, [selectedSalonId]);

  // Pobierz wolne sloty gdy zmienia się data lub salon lub usługa
  useEffect(() => {
    if (!selectedSalonId || !date) {
      setAvailableSlots([]);
      setSelectedTime('');
      return;
    }

    setLoadingSlots(true);
    setSelectedTime('');

    fetch(`/api/appointments?salonId=${selectedSalonId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        const bookedTimes: BookedTime[] = data.bookedTimes || [];
        const selectedService = services.find((s) => String(s.id) === selectedServiceId);
        const duration = selectedService?.duration_minutes || 60;

        const free = ALL_SLOTS.filter((slot) => !isSlotBlocked(slot, duration, bookedTimes));
        setAvailableSlots(free);
        if (free.length > 0) setSelectedTime(free[0]);
      })
      .catch(console.error)
      .finally(() => setLoadingSlots(false));
  }, [selectedSalonId, date, selectedServiceId, services]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalonId) {
      setMessage({ type: 'error', text: 'Wybierz salon przed wysłaniem rezerwacji.' });
      return;
    }
    if (!selectedTime) {
      setMessage({ type: 'error', text: 'Wybierz dostępną godzinę.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          time: selectedTime,
          clientName,
          email,
          phone,
          salonId: selectedSalonId,
          serviceId: selectedServiceId || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: '✅ Rezerwacja potwierdzona! Sprawdź skrzynkę email.' });
        setDate('');
        setSelectedTime('');
        setClientName('');
        setEmail('');
        setPhone('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Wystąpił błąd podczas rezerwacji.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedService = services.find((s) => String(s.id) === selectedServiceId);

  // Jutro jako minimalna data
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-amber-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(217,119,6,0.15)] space-y-6">
        <h1 className="text-3xl font-bold text-center text-amber-400 tracking-wide">
          Zarezerwuj Wizytę
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Wybór salonu */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              Wybierz Salon
            </label>
            {loadingSalons ? (
              <div className="text-sm text-zinc-400 animate-pulse">Ładowanie salonów...</div>
            ) : salons.length > 0 ? (
              <select
                value={selectedSalonId}
                onChange={(e) => setSelectedSalonId(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 rounded-lg px-4 py-3 text-sm outline-none transition-all"
              >
                {salons.map((salon) => (
                  <option key={salon.id} value={salon.id}>
                    {salon.salon_name || salon.name || 'Salon'}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-red-400">Brak dostępnych salonów.</div>
            )}
          </div>

          {/* Wybór usługi */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              1. Wybierz usługę
            </label>
            {loadingServices ? (
              <div className="text-sm text-zinc-400 animate-pulse">Ładowanie usług...</div>
            ) : services.length > 0 ? (
              <>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 rounded-lg px-4 py-3 text-sm outline-none transition-all"
                >
                  {services.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name} {s.price ? `— ${s.price} PLN` : ''} ({s.duration_minutes} min)
                    </option>
                  ))}
                </select>
                {selectedService && (
                  <p className="text-xs text-zinc-500 mt-1">
                    ⏱ Czas trwania: {selectedService.duration_minutes} min
                    {selectedService.price ? ` · 💰 ${selectedService.price} PLN` : ''}
                  </p>
                )}
              </>
            ) : (
              <div className="text-sm text-zinc-500">
                {selectedSalonId ? 'Ten salon nie ma jeszcze usług.' : 'Wybierz salon.'}
              </div>
            )}
          </div>

          {/* Wybierz dzień */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              2. Wybierz dzień
            </label>
            <input
              type="date"
              required
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            />
          </div>

          {/* Wybierz godzinę — dynamiczne wolne sloty */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              3. Wybierz godzinę
            </label>
            {!date ? (
              <p className="text-xs text-zinc-500">Najpierw wybierz dzień.</p>
            ) : loadingSlots ? (
              <p className="text-xs text-zinc-400 animate-pulse">Sprawdzam dostępność...</p>
            ) : availableSlots.length === 0 ? (
              <p className="text-xs text-red-400">Brak wolnych terminów w tym dniu. Wybierz inny dzień.</p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                      selectedTime === slot
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-zinc-900 text-amber-200 border-amber-500/20 hover:border-amber-400'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dane klienta */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
              4. Twoje dane
            </label>
            <input
              type="text"
              placeholder="Imię i Nazwisko"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            />
            <input
              type="email"
              placeholder="Adres E-mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            />
            <input
              type="tel"
              placeholder="Numer Telefonu"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none transition-all"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-xs text-center font-medium border ${
              message.type === 'success'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-red-950/40 border-red-500/50 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedTime || availableSlots.length === 0}
            className="w-full mt-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold py-3.5 rounded-lg text-sm transition-all duration-200 shadow-md hover:shadow-amber-500/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Rezerwowanie...' : selectedTime ? `Potwierdź Rezerwację — ${selectedTime}` : 'Wybierz godzinę'}
          </button>
        </form>

        <div className="pt-4 text-center border-t border-amber-500/20">
          <Link
            href="/admin"
            className="text-xs uppercase font-bold text-amber-400 hover:text-amber-300 hover:underline tracking-widest block py-2"
          >
            PANEL ADMINISTRATORA
          </Link>
        </div>
      </div>
    </div>
  );
}
