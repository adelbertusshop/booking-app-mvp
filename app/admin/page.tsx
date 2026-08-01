'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Pobieranie nadchodzących rezerwacji z bazy
  const fetchAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Błąd pobierania wizyt:', error);
    } else {
      setAppointments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Odwoływanie rezerwacji przez API (Supabase + wysyłka e-maila)
  const updateStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'cancelled') {
      try {
        const res = await fetch('/api/appointments/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id }),
        });

        if (res.ok) {
          fetchAppointments();
        } else {
          const data = await res.json();
          alert(`Błąd: ${data.error || 'Nie udało się odwołać wizyty.'}`);
        }
      } catch (err) {
        console.error('Błąd wysyłania żądania:', err);
        alert('Wystąpił błąd podczas połączenia z serwerem.');
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">Panel Administratora — Rezerwacje</h1>

      {loading ? (
        <p className="text-gray-400">Ładowanie rezerwacji...</p>
      ) : appointments.length === 0 ? (
        <p className="text-gray-400">Brak zarezerwowanych wizyt.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-gray-800">
            <thead>
              <tr className="bg-gray-800 text-gray-300">
                <th className="p-3 border border-gray-700">Data i Godzina</th>
                <th className="p-3 border border-gray-700">Klient</th>
                <th className="p-3 border border-gray-700">Kontakt</th>
                <th className="p-3 border border-gray-700">Status</th>
                <th className="p-3 border border-gray-700">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((item) => {
                const dateObj = new Date(item.start_time);
                const formattedDate = dateObj.toLocaleDateString('pl-PL');
                const formattedTime = dateObj.toLocaleTimeString('pl-PL', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={item.id} className="border-b border-gray-800 hover:bg-gray-900">
                    <td className="p-3 border border-gray-800">
                      <div className="font-semibold">{formattedDate}</div>
                      <div className="text-sm text-gray-400">{formattedTime}</div>
                    </td>
                    <td className="p-3 border border-gray-800 font-medium">
                      {item.client_name}
                    </td>
                    <td className="p-3 border border-gray-800 text-sm">
                      <div>{item.client_email}</div>
                      <div className="text-gray-400">{item.client_phone}</div>
                    </td>
                    <td className="p-3 border border-gray-800">
                      <span
                        className={`px-2 py-1 text-xs rounded font-semibold ${
                          item.status === 'confirmed'
                            ? 'bg-green-900 text-green-300'
                            : 'bg-red-900 text-red-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 border border-gray-800 space-x-2">
                      {item.status !== 'cancelled' && (
                        <button
                          onClick={() => updateStatus(item.id, 'cancelled')}
                          className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition"
                        >
                          Odwołaj
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}