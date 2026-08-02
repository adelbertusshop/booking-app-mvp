'use client';

import { useState } from 'react';

const SERVICES = [
  { id: '1', name: 'Stylizacja Rzęs Volume & Lift', duration: '90 min', price: '180 zł' },
  { id: '2', name: 'Strzyżenie & Stylizacja Premium', duration: '60 min', price: '150 zł' },
  { id: '3', name: 'Manicure Kombinowany + Kolor', duration: '75 min', price: '130 zł' },
  { id: '4', name: 'Laminacja & Regulacja Brwi', duration: '45 min', price: '100 zł' },
];

const TIME_SLOTS = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          service: selectedService,
          date: `${selectedDate} ${selectedTime}`,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        alert('Wystąpił błąd podczas rezerwacji. Spróbuj ponownie.');
      }
    } catch (err) {
      console.error(err);
      alert('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl border border-emerald-500/20">
            ✓
          </div>
          <h2 className="text-2xl font-light tracking-wide text-zinc-100">Wizyta Zarezerwowana</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Dziękujemy! Potwierdzenie wysłaliśmy na Twój adres e-mail. Do zobaczenia w salonie!
          </p>
          <button
            onClick={() => { setSubmitted(false); setStep(1); }}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl font-medium transition duration-200 border border-zinc-700/50"
          >
            Zarezerwuj kolejną wizytę
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full bg-zinc-950 border border-zinc-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-[0.3em] text-zinc-500 font-semibold">System Rezerwacji Online</span>
          <h1 className="text-3xl font-extralight tracking-tight text-white mt-2">Zarezerwuj Wizytę</h1>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-10 px-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                step === s 
                  ? 'bg-white text-black font-bold ring-4 ring-white/10' 
                  : step > s 
                  ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
              }`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`text-xs hidden sm:inline tracking-wider ${step === s ? 'text-white font-medium' : 'text-zinc-600'}`}>
                {s === 1 ? 'Usługa' : s === 2 ? 'Termin' : 'Dane'}
              </span>
            </div>
          ))}
        </div>

        {/* KROK 1: Wybór Usługi */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-4 font-medium">Wybierz usługę:</h2>
            <div className="grid gap-3">
              {SERVICES.map((srv) => (
                <button
                  key={srv.id}
                  onClick={() => setSelectedService(srv.name)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex justify-between items-center ${
                    selectedService === srv.name
                      ? 'bg-zinc-900 border-white text-white shadow-lg shadow-white/5'
                      : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div>
                    <div className="font-medium text-white">{srv.name}</div>
                    <div className="text-xs text-zinc-500 mt-1">{srv.duration}</div>
                  </div>
                  <div className="font-light text-zinc-200">{srv.price}</div>
                </button>
              ))}
            </div>
            <button
              disabled={!selectedService}
              onClick={() => setStep(2)}
              className="w-full mt-6 py-4 bg-white text-black rounded-2xl font-semibold tracking-wide hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200"
            >
              Dalej: Wybierz Termin →
            </button>
          </div>
        )}

        {/* KROK 2: Wybór Daty i Godziny */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm uppercase tracking-wider text-zinc-400 mb-2 font-medium">Data wizyty:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-white transition"
              />
            </div>

            {selectedDate && (
              <div>
                <label className="block text-sm uppercase tracking-wider text-zinc-400 mb-3 font-medium">Dostępne godziny:</label>
                <div className="grid grid-cols-3 gap-3">
                  {TIME_SLOTS.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`py-3 rounded-xl border text-sm font-medium transition ${
                        selectedTime === time
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-4 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl font-medium hover:bg-zinc-800 hover:text-white transition"
              >
                ← Wstecz
              </button>
              <button
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(3)}
                className="w-2/3 py-4 bg-white text-black rounded-2xl font-semibold hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Dalej: Twoje Dane →
              </button>
            </div>
          </div>
        )}

        {/* KROK 3: Dane Klienta i Finalizacja */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800/80 mb-6 text-xs text-zinc-400 space-y-1">
              <div><strong className="text-zinc-200">Wybrana usługa:</strong> {selectedService}</div>
              <div><strong className="text-zinc-200">Termin:</strong> {selectedDate} o {selectedTime}</div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Imię i Nazwisko</label>
              <input
                required
                type="text"
                placeholder="np. Anna Kowalska"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-white focus:outline-none focus:border-white transition"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Numer Telefonu</label>
              <input
                required
                type="tel"
                placeholder="+48 000 000 000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-white focus:outline-none focus:border-white transition"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Adres E-mail</label>
              <input
                required
                type="email"
                placeholder="anna@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-white focus:outline-none focus:border-white transition"
              />
            </div>

            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 py-4 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl font-medium hover:bg-zinc-800 hover:text-white transition"
              >
                ← Wstecz
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 py-4 bg-white text-black rounded-2xl font-semibold hover:bg-zinc-200 disabled:opacity-50 transition"
              >
                {loading ? 'Rezerwuję...' : 'Zatwierdź Rezerwację'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}