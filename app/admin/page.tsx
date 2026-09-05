'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('appointments').select('*');
    if (error) {
      setErrorMsg(error.message);
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  return (
    <div className="min-h-screen bg-black text-amber-100 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-amber-400">
            Panel Zarządzania Rezerwacjami
          </h1>
          <button
            onClick={fetchBookings}
            className="px-4 py-2 bg-zinc-900 border border-amber-500/30 rounded text-amber-400 text-sm"
          >
            Odśwież
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-950 border border-red-500 text-red-400 rounded">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <p className="text-amber-400/60">Ładowanie danych...</p>
        ) : (
          <div className="bg-zinc-950 border border-amber-500/30 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900 text-amber-400 text-xs uppercase border-b border-amber-500/20">
                  <th className="p-4">Klient</th>
                  <th className="p-4">Usługa</th>
                  <th className="p-4">Termin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10 text-sm">
                {bookings.map((item) => {
                  const client = item.clientName || item.client_name || item.name || item.email || 'Brak danych';
                  
                  // Próbujemy odczytać nazwę usługi ze wszystkich możliwych kluczy
                  const service = 
                    item.serviceName || 
                    item.service_name || 
                    item.service || 
                    item.service_type || 
                    item.usluga || 
                    item.selectedService ||
                    (typeof item === 'object' ? Object.values(item).find(v => typeof v === 'string' && v !== client && !v.includes('@') && !v.includes('-')) : null) ||
                    'Nieznana usługa';

                  const date = item.date || item.booking_date || '';
                  const time = item.time || item.booking_time || '';

                  return (
                    <tr key={item.id || Math.random()}>
                      <td className="p-4 font-bold text-amber-300">{String(client)}</td>
                      <td className="p-4 text-amber-100 font-semibold">{String(service)}</td>
                      <td className="p-4 text-zinc-300">{String(date)} {String(time)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}