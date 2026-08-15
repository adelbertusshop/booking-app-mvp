'use client';

import { useState, useEffect } from 'react';

export default function BookingPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [serviceId, setServiceId] = useState<number>(1);
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch('/api/services');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setServices(data);
          setServiceId(data[0].id);
        }
      } catch (err) {
        console.error('Błąd:', err);
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
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setMessage('Rezerwacja potwierdzona!');
      } else {
        setMessage('Błąd rezerwacji.');
      }
    } catch {
      setMessage('Błąd serwera.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h1 className="text-2xl font-bold text-center mb-6">Zarezerwuj Wizytę</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* NOWA SEKCJA: WYBIERZ USŁUGĘ */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">1. WYBIERZ USŁUGĘ</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.price} zł, {s.duration} min)</option>
              ))}
            </select>
          </div>

         <div>
  <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
    1. Wybierz usługę
  </label>
  <select
    value={serviceId || ""}
    onChange={(e) => setServiceId(Number(e.target.value))}
    className="w-full bg-slate-800 border border-slate-700 text-white rounded p-2"
  >
    <option value="" disabled className="bg-slate-800 text-slate-400">
      -- Wybierz usługę z listy --
    </option>
    {services && services.length > 0 ? (
      services.map((s) => (
        <option key={s.id} value={s.id} className="bg-slate-800 text-white">
          {s.name} ({s.price} zł, {s.duration_minutes} min)
        </option>
      ))
    ) : (
      <option disabled className="bg-slate-800 text-slate-400">
        Ładowanie usług lub brak danych...
      </option>
    )}
  </select>
</div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">4. TWOJE DANE</label>
            <input type="text" placeholder="Imię i Nazwisko" onChange={(e) => setName(e.target.value)} className="w-full bg-slate-800 border p-3 rounded-lg" />
            <input type="email" placeholder="Adres E-mail" onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800 border p-3 rounded-lg" />
            <input type="tel" placeholder="Numer Telefonu" onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-800 border p-3 rounded-lg" />
          </div>

          <button type="submit" className="w-full bg-white text-black font-bold p-3 rounded-lg">Potwierdź Rezerwację</button>
        </form>
      </div>
    </div>
  );
}