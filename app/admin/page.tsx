'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cnfrbelkckbtkzhwyxqm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZnJiZWxrY2tidGt6aHd5eHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NzE3OTksImV4cCI6MjEwMDU0Nzc5OX0.OP4KOrwfUgAz6xi0UNf9uM69abKF1R2K8COexZrBGsA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function AdminLoginPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from('appointments')
      .select('*');

    if (error) {
      console.error('Błąd Supabase:', error);
      setErrorMessage(`${error.message} (Kod: ${error.code})`);
    } else if (data) {
      setBookings(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  const handleCancelBooking = async (id: string, email: string) => {
    setActionLoading(id);

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (!error) {
      try {
        await fetch('/api/cancel-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: id, email }),
        });
      } catch (err) {
        console.error('Błąd wysyłki maila:', err);
      }
      await fetchBookings();
    }
    setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-teal-400">Panel Zarządzania Rezerwacjami</h1>
            <p className="text-slate-400 text-sm">Prawdziwe dane z bazy Supabase</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchBookings}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg border border-slate-700 transition-colors"
            >
              Odśwież dane
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-sm font-medium rounded-lg text-white transition-colors"
            >
              Wyloguj się
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-900/50 border border-rose-500 rounded-lg text-rose-200 text-sm font-mono">
            <strong>BŁĄD SUPABASE:</strong> {errorMessage}
          </div>
        )}
        
        {loading ? (
          <p className="text-slate-400">Ładowanie bazy Supabase...</p>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-300 text-xs uppercase border-b border-slate-700">
                  <th className="p-4">Klient</th>
                  <th className="p-4">Usługa</th>
                  <th className="p-4">Termin</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">
                      Brak rezerwacji w bazie Supabase.
                    </td>
                  </tr>
                ) : (
                  bookings.map((item) => {
                    const clientName = item.client_name || item.name || item.full_name || 'Brak danych';
                    const clientEmail = item.email || item.client_email || '';
                    const dateFormatted = item.start_time 
                      ? new Date(item.start_time).toLocaleString('pl-PL')
                      : `${item.date || ''} ${item.time || ''}`;
                    const isCancelled = item.status === 'cancelled' || item.status === 'Anulowana';

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/50">
                        <td className="p-4 font-semibold">
                          {clientName}
                          {clientEmail && <br/>}
                          <span className="text-xs text-slate-400 font-normal">{clientEmail}</span>
                        </td>
                        <td className="p-4">{item.service || item.service_name || 'Konsultacja'}</td>
                        <td className="p-4">{dateFormatted}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 text-xs rounded-full border ${
                            isCancelled 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                              : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                          }`}>
                            {isCancelled ? 'Anulowana' : (item.status || 'Potwierdzono')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {!isCancelled && (
                            <button
                              disabled={actionLoading === item.id}
                              onClick={() => handleCancelBooking(item.id, clientEmail)}
                              className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded text-xs transition-colors disabled:opacity-50"
                            >
                              {actionLoading === item.id ? 'Anulowanie...' : 'Odwołaj'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}