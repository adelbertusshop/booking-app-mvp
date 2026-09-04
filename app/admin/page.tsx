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

  // 1. Dedykowane usuwanie wpisu bez wysyłania e-maila
  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Czy na pewno chcesz bezpowrotnie usunąć tę rezerwację z bazy?')) return;

    setActionLoading(id);

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Błąd podczas usuwania z Supabase:', error);
      alert(`Błąd usuwania: ${error.message}`);
    } else {
      setBookings((prev) => prev.filter((item) => item.id !== id));
    }

    setActionLoading(null);
  };

  // 2. Anulowanie wpisu z powiadomieniem mailowym
  const handleCancelBooking = async (id: string, email: string) => {
    setActionLoading(id);

    try {
      await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id, email }),
      });
    } catch (err) {
      console.error('Błąd wysyłki maila:', err);
    }

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Błąd podczas usuwania z Supabase:', error);
    } else {
      await fetchBookings();
    }

    setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-black text-amber-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-amber-400 tracking-wide">Panel Zarządzania Rezerwacjami</h1>
            <p className="text-amber-200/60 text-sm">Prawdziwe dane z bazy Supabase</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchBookings}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 text-sm rounded-lg border border-amber-500/30 transition-colors font-medium"
            >
              Odśwież dane
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm rounded-lg transition-all shadow-md"
            >
              Wyloguj się
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-950/50 border border-red-500 rounded-lg text-red-200 text-sm font-mono">
            <strong>BŁĄD SUPABASE:</strong> {errorMessage}
          </div>
        )}

        {loading ? (
          <p className="text-amber-400/60">Ładowanie bazy Supabase...</p>
        ) : (
          <div className="bg-zinc-950 border border-amber-500/30 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(217,119,6,0.08)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900 text-amber-400 text-xs uppercase border-b border-amber-500/20 font-semibold">
                  <th className="p-4">Klient</th>
                  <th className="p-4">Usługa</th>
                  <th className="p-4">Termin</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10 text-sm">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zinc-500 font-medium">
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
                      <tr key={item.id} className="hover:bg-zinc-900/60 transition-colors">
                        <td className="p-4 font-medium text-amber-100">
                          {clientName}
                          {clientEmail && <br/>}
                          <span className="text-xs text-amber-200/50 font-normal">{clientEmail}</span>
                        </td>
                        <td className="p-4 text-amber-200/80">{item.service || item.service_name || 'Konsultacja'}</td>
                        <td className="p-4 text-amber-200/80">{dateFormatted}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 text-xs rounded-full border font-medium ${
                            isCancelled 
                              ? 'bg-rose-950/40 text-rose-400 border-rose-500/30' 
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}>
                            {isCancelled ? 'Anulowana' : (item.status || 'Potwierdzono')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              disabled={actionLoading === item.id}
                              onClick={() => handleCancelBooking(item.id, clientEmail)}
                              className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-xs transition-colors disabled:opacity-50"
                            >
                              Odwołaj
                            </button>
                            <button
                              disabled={actionLoading === item.id}
                              onClick={() => handleDeleteBooking(item.id)}
                              className="px-3 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded text-xs transition-colors disabled:opacity-50"
                            >
                              {actionLoading === item.id ? 'Usuwanie...' : 'Usuń'}
                            </button>
                          </div>
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