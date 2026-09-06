'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState<any[]>([]);
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
      .select('*');

    if (!error && data) {
      setAppointments(data);
    }
    setLoading(false);
  };

  const handleCancel = async (id: any) => {
    if (!confirm('Czy na pewno chcesz odwołać tę wizytę?')) return;

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Błąd podczas odwoływania wizyty: ' + error.message);
    } else {
      setAppointments((prev) => prev.filter((item) => item.id !== id));
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

  // Pomocnicza funkcja wyciągająca wartość pola niezależnie od nazwy kolumny w Supabase
  const getValue = (item: any, keys: string[]) => {
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
        return item[key];
      }
    }
    return '-';
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
              Odśwież dane
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
                  {appointments.map((item, idx) => {
                    const client = getValue(item, ['client_name', 'name', 'client', 'full_name', 'user_name']);
                    const service = getValue(item, ['service_name', 'service', 'title', 'service_type', 'details']);
                    const date = getValue(item, ['date', 'appointment_date', 'booking_date', 'created_at']);
                    const time = getValue(item, ['time', 'appointment_time', 'booking_time', 'slot']);
                    const email = getValue(item, ['email', 'client_email', 'user_email']);
                    const phone = getValue(item, ['phone', 'telephone', 'client_phone', 'phone_number']);

                    return (
                      <tr key={item.id || idx} className="hover:bg-zinc-900/50">
                        <td className="p-3 font-semibold text-amber-300">{client}</td>
                        <td className="p-3">{service}</td>
                        <td className="p-3 text-amber-100">{typeof date === 'string' && date.includes('T') ? date.split('T')[0] : date}</td>
                        <td className="p-3">{time}</td>
                        <td className="p-3 text-zinc-400">{email}</td>
                        <td className="p-3 text-zinc-400">{phone}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleCancel(item.id)}
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
