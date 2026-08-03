'use client';

import { useState, useEffect } from 'react';

export default function BookingPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Ustawiamy dzisiejszą datę przy pierwszym załadowaniu
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  }, []);

  // Pobieramy dostępne godziny po zmianie daty
  useEffect(() => {
    if (!selectedDate) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSelectedTime('');

      try {
        const res = await fetch(`/api/appointments/available-slots?date=${selectedDate}`);
        const data = await res.json();
        if (res.ok) {
          setAvailableSlots(data.availableSlots || []);
        } else {
          console.error(data.error);
        }
      } catch (err) {
        console.error('Błąd pobierania slotów:', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      setMessage('Wybierz datę i godzinę!');
      return;
    }

    setSubmitting(true);
    setMessage('');

    const fullStartDateTime = `${selectedDate}T${selectedTime}:00`;

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: name,
          client_email: email,
          client_phone: phone,
          start_time: fullStartDateTime,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(' Rezerwacja złożona pomyślnie!');
        setName('');
        setEmail('');
        setPhone('');
        setSelectedTime('');
        
        // Odświeżenie slotów po rejestracji
        const refreshed = await fetch(`/api/appointments/available-slots?date=${selectedDate}`);
        const refreshedData = await refreshed.json();
        if (refreshed.ok) setAvailableSlots(refreshedData.availableSlots || []);
      } else {
        setMessage(` Błąd: ${data.error || 'Nie udało się zarezerwować.'}`);
      }
    } catch (err) {
      setMessage(' Wystąpił błąd podczas wysyłania zgłoszenia.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Zarezerwuj Wizytę</h1>
          <p className="text-sm text-slate-400 mt-1">Wybierz dogodny termin i podaj swoje dane.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              1. Wybierz Dzień
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              2. Wybierz Godzinę
            </label>
            {loadingSlots ? (
              <p className="text-xs text-slate-500">Sprawdzanie dostępności...</p>
            ) : availableSlots.length === 0 ? (
              <p className="text-xs text-rose-400">Brak wolnych terminów w tym dniu.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`py-2 text-sm font-mono rounded border transition ${
                      selectedTime === slot
                        ? 'bg-slate-100 text-slate-950 font-bold border-white'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              3. Twoje Dane
            </label>

            <div>
              <input
                type="text"
                placeholder="Imię i Nazwisko"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <input
                type="email"
                placeholder="Adres E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <input
                type="tel"
                placeholder="Numer Telefonu"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedTime}
            className="w-full bg-slate-100 hover:bg-white text-slate-950 font-semibold py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Zapisywanie...' : 'Potwierdź Rezerwację'}
          </button>
        </form>

        {message && (
          <p className="text-center text-sm font-medium text-slate-300 bg-slate-950 py-2 border border-slate-800 rounded">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}