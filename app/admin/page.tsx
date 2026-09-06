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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true });

      if (!error && data) {
        setAppointments(data);
      }
      setLoading(false);
    }

    fetchAppointments();
  }, []);

  return (
    <main className="min-h-screen bg-black text-amber-100 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-amber-400 border-b border-amber-500/30 pb-4">
          Panel Administratora - Rezerwacje
        </h1>

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
