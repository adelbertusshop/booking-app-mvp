'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Appointment {
  id: number;
  client_name: string;
  client_email: string;
  client_phone: string;
  start_time: string;
  status: string;
}

export default function AdminPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    setLoading(true);
    // Sortowanie po ID malejąco (najnowsze wpisy na samej górze)
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('Błąd pobierania wizyt:', error.message);
    } else {
      setAppointments(data || []);
    }
    setLoading(false);
  };

  const handleCancel = async (id: number) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      alert('Nie udało się odwołać wizyty: ' + error.message);
    } else {
      fetchAppointments();
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-slate-100">
          Panel Administratora — Rezerwacje
        </h1>

        {loading ? (
          <p className="text-slate-400">Ładowanie rezerwacji...</p>
        ) : appointments.length === 0 ? (
          <p className="text-slate-400">Brak zarezerwowanych wizyt.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-sm">
                  <th className="py-3 px-4">Termin</th>
                  <th className="py-3 px-4">Klient</th>
                  <th className="py-3 px-4">Kontakt</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {appointments.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-900/50">
                    <td className="py-4 px-4 text-sm font-mono">
                      {new Date(app.start_time).toLocaleString('pl-PL')}
                    </td>
                    <td className="py-4 px-4 font-semibold">{app.client_name}</td>
                    <td className="py-4 px-4 text-sm text-slate-300">
                      <div>{app.client_email}</div>
                      <div className="text-xs text-slate-500">{app.client_phone}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 text-xs rounded-full border ${
                          app.status === 'confirmed'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {app.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancel(app.id)}
                          className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded transition"
                        >
                          Odwołaj
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}