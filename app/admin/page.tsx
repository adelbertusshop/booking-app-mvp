'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const [activeTab, setActiveTab] = useState<'appointments' | 'settings'>('appointments');

  // Dane rezerwacji
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  // Dane ustawień admina
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const loggedIn = sessionStorage.getItem('admin_logged_in');
    if (loggedIn === 'true') {
      setIsAuthenticated(true);
      fetchAppointments();
      fetchSettings();
    }
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('admin_settings').select('*').eq('id', 1).single();
    if (data) {
      setAdminEmail(data.admin_email || '');
      setAdminPassword(data.admin_password || '');
      setWhatsappTemplate(data.whatsapp_template || '');
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });

    if (!error && data) {
      setAppointments(data as Appointment[]);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Pobranie aktualnego hasła z bazy
    const { data } = await supabase.from('admin_settings').select('admin_password').eq('id', 1).single();
    const currentPass = data?.admin_password || 'Wojownik.03';

    if (password === currentPass) {
      sessionStorage.setItem('admin_logged_in', 'true');
      setIsAuthenticated(true);
      setError('');
      fetchAppointments();
      fetchSettings();
    } else {
      setError('Nieprawidłowe hasło!');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    const { error } = await supabase.from('admin_settings').upsert({
      id: 1,
      admin_email: adminEmail,
      admin_password: adminPassword,
      whatsapp_template: whatsappTemplate,
    });

    setSavingSettings(false);

    if (!error) {
      alert('Ustawienia zostały pomyślnie zapisane!');
    } else {
      alert('Błąd podczas zapisywania ustawień: ' + error.message);
    }
  };

  const handleCancel = async (item: Appointment) => {
    if (!confirm(`Czy na pewno chcesz odwołać wizytę klienta ${item.client_name || ''}?`)) return;

    try {
      const res = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: item.id,
          email: item.client_email,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAppointments((prev) => prev.filter((row) => row.id !== item.id));
        alert('Wizyta została odwołana, a powiadomienia e-mail zostały wysłane.');
      } else {
        alert('Błąd podczas odwoływania wizyty: ' + (data.error || 'Nieznany błąd'));
      }
    } catch (e: any) {
      alert('Wystąpił błąd podczas połączenia z serwerem.');
    }
  };

  const handleWhatsApp = (item: Appointment) => {
    if (!item.client_phone) {
      alert('Brak numeru telefonu klienta.');
      return;
    }

    let cleanPhone = item.client_phone.replace(/\D/g, '');
    if (cleanPhone.length === 9) cleanPhone = `48${cleanPhone}`;

    const { date, time } = formatDateTime(item.start_time);
    const serviceName = SERVICES_MAP[item.service_id] || `Usługa #${item.service_id}`;

    // Podmiana zmiennych w szablonie
    let text = whatsappTemplate || 'Cześć {NAME}! Przypominamy o Twojej wizycie: {SERVICE} w dniu {DATE} o godz. {TIME}.';
    text = text
      .replace('{NAME}', item.client_name || '')
      .replace('{SERVICE}', serviceName)
      .replace('{DATE}', date)
      .replace('{TIME}', time);

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
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
        {/* NAGŁÓWEK I NAWIGACJA ZAKŁADEK */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-amber-500/30 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-amber-400">Panel Administratora</h1>
            <div className="flex space-x-4 mt-2">
              <button
                onClick={() => setActiveTab('appointments')}
                className={`text-sm font-semibold pb-1 border-b-2 transition-all ${
                  activeTab === 'appointments'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-amber-200'
                }`}
              >
                Rezerwacje
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`text-sm font-semibold pb-1 border-b-2 transition-all ${
                  activeTab === 'settings'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-amber-200'
                }`}
              >
                Ustawienia Admina
              </button>
            </div>
          </div>

          <div className="space-x-3">
            {activeTab === 'appointments' && (
              <button
                onClick={fetchAppointments}
                className="bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 px-4 py-2 rounded-lg text-xs font-bold transition-all"
              >
                Odśwież
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            >
              Wyloguj
            </button>
          </div>
        </div>

        {/* ZAKŁADKA 1: REZERWACJE */}
        {activeTab === 'appointments' && (
          <>
            {loading ? (
              <p className="text-amber-200">Ładowanie rezerwacji...</p>
            ) : (
              <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl overflow-x-auto">
                {appointments.length === 0 ? (
                  <p className="text-zinc-500 text-sm">Brak aktywnych rezerwacji.</p>
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
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => handleWhatsApp(item)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow"
                              >
                                WhatsApp
                              </button>
                              <button
                                onClick={() => handleCancel(item)}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow"
                              >
                                Odwołaj
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
          </>
        )}

        {/* ZAKŁADKA 2: USTAWIENIA ADMINA */}
        {activeTab === 'settings' && (
          <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl max-w-xl">
            <h2 className="text-xl font-bold text-amber-400 mb-6">Ustawienia Konta i WhatsApp</h2>
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase mb-2">E-mail Administratora</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase mb-2">Hasło Logowania</label>
                <input
                  type="text"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase mb-2">
                  Szablon Wiadomości WhatsApp
                </label>
                <textarea
                  rows={4}
                  value={whatsappTemplate}
                  onChange={(e) => setWhatsappTemplate(e.target.value)}
                  className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                />
                <p className="text-zinc-500 text-xs mt-1">
                  Dostępne tagi dynamiczne: <code className="text-amber-400">{'{NAME}'}</code>, <code className="text-amber-400">{'{SERVICE}'}</code>, <code className="text-amber-400">{'{DATE}'}</code>, <code className="text-amber-400">{'{TIME}'}</code>
                </p>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-lg transition-colors text-sm"
              >
                {savingSettings ? 'Zapisywanie...' : 'Zapisz Ustawienia'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
