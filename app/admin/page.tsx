'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mapowanie ID usług na ich czytelne nazwy
const SERVICES_MAP: Record<number | string, string> = {
  1: 'Stylistka rzęs',
  2: 'Przedłużanie rzęs',
  3: 'Laminacja brwi',
};

interface Appointment {
  id: number | string;
  client_name: string;
  client_email: string;
  client_phone: string;
  start_time: string;
  service_id: number | string;
  status?: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loggedIn = sessionStorage.getItem('admin_logged_in');
    if (loggedIn === 'true') {
      setIsAuthenticated(true);
      fetchAppointments();
    }
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('start_time', { ascending: true });

    if (!error && data) {
      setAppointments(data as Appointment[]);
    }
    setLoading(false);
  };

  const handleCancel = async (item: Appointment) => {
    if (!confirm(`Czy na pewno chcesz odwołać wizytę klienta ${item.client_name || ''}?`)) return;

    const { date, time } = formatDateTime(item.start_time);
    const serviceName = SERVICES_MAP[item.service_id] || `Usługa #${item.service_id}`;

    try {
      // Send cancellation email notification
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: item.client_email,
          subject: '[ODWOŁANIE REZERWACJI] Twoja wizyta została anulowana',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2>Wizyta została odwołana</h2>
              <p>Witaj <strong>${item.client_name || 'Kliencie'}</strong>,</p>
              <p>Informujemy, że Twoja rezerwacja została odwołana przez administratora.</p>
              <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
              <h3>Szczegóły odwołanej wizyty:</h3>
              <ul>
                <li><strong>Usługa:</strong> ${serviceName}</li>
                <li><strong>Data:</strong> ${date}</li>
                <li><strong>Godzina:</strong> ${time}</li>
              </ul>
              <p style="margin-top: 20px;">Przepraszamy za niedogodności.</p>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.error('Błąd podczas wysyłania wiadomości e-mail:', e);
    }

    // Delete record from Supabase
    const { error } = await supabase.from('appointments').delete().eq('id', item.id);

    if (error) {
      alert('Błąd podczas odwoływania wizyty w bazie: ' + error.message);
    } else {
      setAppointments((prev) => prev.filter((row) => row.id !== item.id));
      alert('Wizyta została odwołana, a powiadomienie e-mail zostało wysłane do klienta.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Wojownik.03') {
      sessionStorage.setItem('admin_logged_in', 'true');
      setIsAuthenticated(true);
      setError('');
      fetchAppointments();
    } else {
      setError('Nieprawidłowe hasło!');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_logged_in');
    setIsAuthenticated(false);
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return { date: '-', time: '-' };
    try {
      const dt = new Date(isoString);
      const date = dt.toISOString().split('T')[0];
      const time = dt.toTimeString().substring(0, 5);
      return { date, time };
    } catch {
      return { date: isoString, time: '' };
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-zinc-950 border border-amber-500/30 p-8 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
          <h1 className="text-xl font-bold text-amber-400 text-center">Logowanie do Admina</h1>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Wpisz hasło..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 pr-16 text-amber-100 focus:outline-none focus:border-amber-400 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-300 text-xs font-bold"
            >
              {showPassword ? 'UKRYJ' : 'POKAŻ'}
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg transition-colors text-sm"
          >
            Zaloguj się
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-amber-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-amber-500/30 pb-4">
          <h1 className="text-3xl font-bold text-amber-400">
            Panel Administratora - Rezerwacje
          </h1>
          <div className="space-x-3">
            <button
              onClick={fetchAppointments}
              className="bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            >
              Odśwież
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            >
              Wyloguj
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-amber-200">Ładowanie rezerwacji...</p>
        ) : (
          <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl overflow-x-auto">
            {appointments.length === 0 ? (
              <p className="text-zinc-500 text-sm">Brak rezerwacji w bazie.</p>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-amber-500/30 text-amber-400 uppercase text-xs">
                    <th className="p-3">Klient</th>
                    <th className="p-3">Usługa</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Godzina</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Telefon</th>
                    <th className="p-3 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {appointments.map((item) => {
                    const { date, time } = formatDateTime(item.start_time);
                    const serviceName = SERVICES_MAP[item.service_id] || `Usługa #${item.service_id}`;

                    return (
                      <tr key={item.id} className="hover:bg-zinc-900/50">
                        <td className="p-3 font-semibold text-amber-300">{item.client_name || '-'}</td>
                        <td className="p-3">{serviceName}</td>
                        <td className="p-3 text-amber-100">{date}</td>
                        <td className="p-3 text-amber-100">{time}</td>
                        <td className="p-3 text-zinc-400">{item.client_email || '-'}</td>
                        <td className="p-3 text-zinc-400">{item.client_phone || '-'}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleCancel(item)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow"
                          >
                            Odwołaj wizytę
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
