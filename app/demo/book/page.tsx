'use client';

import { useState } from 'react';

const SERVICES = [
  { id: '1', name: 'Stylizacja Rzęs Volume & Lift' },
  { id: '2', name: 'Strzyżenie & Stylizacja Premium' },
  { id: '3', name: 'Manicure Kombinowany + Kolor' },
  { id: '4', name: 'Laminacja & Regulacja Brwi' },
];

const TIME_SLOTS = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('2026-03-25');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          service: selectedService,
          date: `${selectedDate} o ${selectedSlot}`,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert('Rezerwacja przebiegła pomyślnie!');
        setStep(1);
        setFormData({ name: '', phone: '', email: '' });
      } else {
        alert(data.error || 'Wystąpił błąd podczas rezerwacji. Spróbuj ponownie.');
      }
    } catch (err) {
      console.error(err);
      alert('Wystąpił błąd połączenia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between mb-8 border-b border-neutral-800 pb-4">
          <span className={step === 1 ? 'text-white font-bold' : 'text-neutral-500'}>1. Usługa</span>
          <span className={step === 2 ? 'text-white font-bold' : 'text-neutral-500'}>2. Termin</span>
          <span className={step === 3 ? 'text-white font-bold' : 'text-neutral-500'}>3. Dane</span>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold mb-4">Wybierz usługę</h2>
            {SERVICES.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSelectedService(s.name); setStep(2); }}
                className={`w-full text-left p-4 rounded-xl border transition ${
                  selectedService === s.name ? 'border-white bg-neutral-800' : 'border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Wybierz godzinę</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-3 text-center rounded-xl border transition ${
                    selectedSlot === slot ? 'border-white bg-neutral-800' : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="w-1/2 p-3 rounded-xl border border-neutral-800 text-neutral-400">
                ← Wstecz
              </button>
              <button
                disabled={!selectedSlot}
                onClick={() => setStep(3)}
                className="w-1/2 p-3 rounded-xl bg-white text-black font-semibold disabled:opacity-50"
              >
                Dalej
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-semibold mb-2">Twoje dane</h2>
            <p className="text-sm text-neutral-400 mb-4">
              Usługa: {selectedService}<br />
              Termin: {selectedDate} o {selectedSlot}
            </p>

            <div>
              <label className="text-xs uppercase text-neutral-400 font-semibold">Imię i Nazwisko</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-white"
              />
            </div>

            <div>
              <label className="text-xs uppercase text-neutral-400 font-semibold">Numer Telefonu</label>
              <input
                required
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-white"
              />
            </div>

            <div>
              <label className="text-xs uppercase text-neutral-400 font-semibold">Adres E-mail</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-white"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setStep(2)} className="w-1/2 p-3 rounded-xl border border-neutral-800 text-neutral-400">
                ← Wstecz
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-1/2 p-3 rounded-xl bg-white text-black font-semibold disabled:opacity-50"
              >
                {loading ? 'Rezerwuję...' : 'Rezerwuj'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}