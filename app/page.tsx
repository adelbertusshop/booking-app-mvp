'use client';

import { useState, useEffect } from 'react';

export default function BookingPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [serviceId, setServiceId] = useState<number | ''>('');
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch('/api/appointments/services');
        const data = await res.json();

        console.log('Status odpowiedzi services:', res.status);
        console.log('Otrzymane usługi:', data);

        if (res.ok && Array.isArray(data) && data.length > 0) {
          setServices(data);
          setServiceId(data[0].id);
        } else if (data.error) {
          console.error('Błąd z API usług:', data.error);
        }
      } catch (err) {
        console.error('Błąd sieci/pobierania usług:', err);
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const res = await fetch(`/api/appointments/available-slots?date=${selectedDate}`);
        const data = await res.json();
        setAvailableSlots(data.availableSlots || []);
      } catch (err) {
        console.error('Błąd pobierania slotów:', err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !selectedDate || !selectedTime) {
      setMessage('Wypełnij wszystkie pola rezerwacji.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: name,
          client_email: email,
          client_phone: phone,
          start_time: `${selectedDate}T${selectedTime}:00`,
          service_id: serviceId,
        }),
      });

      if (res.ok) {
        setMessage('Rezerwacja została pomyślnie złożona!');
      } else {
        const errorData = await res.json();
        setMessage(`Błąd rezerwacji: ${errorData.error || 'Spróbuj ponownie.'}`);
      }
    } catch (err) {
      setMessage('Błąd połączenia z serwerem.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h1 className="text-2xl font-bold text-center mb-6">Zarezerwuj Wizytę</h1>
        
        {message && (
          <div className="mb-4 p-3 bg-blue-600/20 border border-blue-500 rounded text-center text-sm text-blue-200">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. WYBIERZ USŁUGĘ */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              1. Wybierz usługę
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3"
            >
              {loadingServices ? (
                <option value="" disabled className="bg-slate-800 text-slate-400">
                  Ładowanie usług...
                </option>
              ) : services.length > 0 ? (
                services.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-800 text-white">
                    {s.name} ({s.price} zł, {s.duration_minutes} min)
                  </option>
                ))
              ) : (
                <option value="" disabled className="bg-slate-800 text-slate-400">
                  Brak dostępnych usług
                </option>
              )}
            </select>
          </div>

          {/* 2. WYBIERZ DZIEŃ */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              2. WYBIERZ DZIEŃ
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3"
            />
          </div>

          {/* 3. WYBIERZ GODZINĘ */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              3. WYBIERZ GODZINĘ
            </label>
            {loadingSlots ? (
              <p className="text-xs text-slate-400">Ładowanie wolnych terminów...</p>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`p-2 rounded-lg text-xs font-semibold transition ${
                      selectedTime === slot
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {selectedDate ? 'Brak wolnych godzin w tym dniu.' : 'Wybierz najpierw dzień.'}
              </p>
            )}
          </div>

          {/* 4. TWOJE DANE */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              4. TWOJE DANE
            </label>
            <input
              type="text"
              placeholder="Imię i Nazwisko"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-white"
            />
            <input
              type="email"
              placeholder="Adres E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-white"
            />
            <input
              type="tel"
              placeholder="Numer Telefonu"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-white text-black font-bold p-3 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
          >
            {submitting ? 'Rezerwowanie...' : 'Potwierdź Rezerwację'}
          </button>
        </form>
      </div>
    </div>
  );
}