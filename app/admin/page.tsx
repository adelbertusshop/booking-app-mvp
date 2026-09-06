'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Appointment {
  id: string;
  service_name: string;
  date: string;
  time: string;
  client_name: string;
  email: string;
  phone: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
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
      .order('date', { ascending: true });

    if (!error && data) {
      setAppointments(data);
    }
    setLoading(false);
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

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-zinc-950 border border-amber-500/30 p-8 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
          <h1 className="text-xl font-bold text-amber-400 text-center">Logowanie do Admina</h1>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <input
            type="password"
            placeholder="Wpisz hasło..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 focus:outline-none focus:border-amber-400 text-sm"
          />
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-amber-500/30 pb-4">
          <h1 className="text-3xl font-bold text-amber-400">
            Panel Administratora - Rezerwacje
          </h1>
          <button
            onClick={handleLogout}
            className="bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 px-4 py-2 rounded-lg text-xs font-bold transition-all"
          >
            Wyloguj
          </button>
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
                    <th className="p-3">Data</th>
                    <th className="p-3">Godzina</th>
                    <th className="p-3">Usługa</th>
                    <th className="p-3">Klient</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Telefon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {appointments.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/50">
                      <td className="p-3 text-amber-200">{item.date}</td>
                      <td className="p-3">{item.time}</td>
                      <td className="p-3">{item.service_name}</td>
                      <td className="p-3 font-medium">{item.client_name}</td>
                      <td className="p-3 text-zinc-400">{item.email}</td>
                      <td className="p-3 text-zinc-400">{item.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
