'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SERVICES_MAP: Record<number | string, string> = {
  1: 'Strzyżenie męskie',
  2: 'Strzyżenie damskie',
  3: 'Koloryzacja',
};

interface Appointment {
  id: number | string;
  client_name: string;
  client_email: string;
  client_phone: string;
  start_time: string;
  service_id: number | string;
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Stany formularza auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Stany panelu
  const [activeTab, setActiveTab] = useState<'appointments' | 'settings'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Stany ustawień salonu
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    // Sprawdzenie sesji po starcie
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadSalonData(session.user);
      }
      setLoadingAuth(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadSalonData(session.user);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const loadSalonData = async (currentUser: any) => {
    setLoadingData(true);

    // Szukamy salonu przypisanego do user_id
    let { data: salon } = await supabase.from('salons').select('*').eq('user_id', currentUser.id).single();

    // Jeśli jeszcze nie ma wiersza salonu dla tego konta, tworzymy go automatycznie
    if (!salon) {
      const { data: newSalon, error: createError } = await supabase
        .from('salons')
        .insert([{ user_id: currentUser.id, admin_email: currentUser.email || '' }])
        .select()
        .single();

      if (!createError) salon = newSalon;
    }

    if (salon) {
      setSalonId(salon.id);
      setSalonName(salon.salon_name || 'Mój Salon');
      setAdminEmail(salon.admin_email || currentUser.email || '');
      setWhatsappTemplate(
        salon.whatsapp_template ||
          'Cześć {NAME}! Przypominamy o Twojej wizycie: {SERVICE} w dniu {DATE} o godz. {TIME}. Do zobaczenia!'
      );
      fetchAppointments(salon.id);
    }
    setLoadingData(false);
  };

  const fetchAppointments = async (currentSalonId: string) => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('salon_id', currentSalonId)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });

    if (data) setAppointments(data as Appointment[]);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegistering) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setError(error.message);
      } else if (data?.user) {
        alert('Konto zostało zarejestrowane! Logowanie...');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setError('Nieprawidłowy e-mail lub hasło.');
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    // 1. Zmiana hasła w Supabase Auth (jeśli wpisano nowe)
    if (newPassword.trim().length > 0) {
      const { error: passErr } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (passErr) {
        alert('Błąd zmiany hasła: ' + passErr.message);
        setSavingSettings(false);
        return;
      }
      setNewPassword('');
    }

    // 2. Zapis ustawień w tabeli 'salons'
    if (salonId) {
      const { error: salonErr } = await supabase
        .from('salons')
        .update({
          salon_name: salonName,
          admin_email: adminEmail,
          whatsapp_template: whatsappTemplate,
        })
        .eq('id', salonId);

      if (salonErr) {
        alert('Błąd zapisu ustawień salonu: ' + salonErr.message);
      } else {
        alert('Wszystkie ustawienia zostały pomyślnie zapisane!');
      }
    }

    setSavingSettings(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
        <p className="text-amber-400 font-bold animate-pulse">Ładowanie panelu...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
        <form onSubmit={handleAuth} className="bg-zinc-950 border border-amber-500/30 p-8 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
          <h1 className="text-xl font-bold text-amber-400 text-center">
            {isRegistering ? 'Rejestracja Salonu' : 'Logowanie do Panelu'}
          </h1>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <div>
            <label className="block text-xs font-bold text-amber-300 uppercase mb-1">E-mail</label>
            <input
              type="email"
              placeholder="admin@salon.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Hasło</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors">
            {isRegistering ? 'Zarejestruj Salon' : 'Zaloguj się'}
          </button>

          <button
            type="button"
            onClick={() => {
              setError('');
              setIsRegistering(!isRegistering);
            }}
            className="w-full text-xs text-amber-400/80 hover:text-amber-300 text-center block pt-2"
          >
            {isRegistering ? 'Masz już konto? Zaloguj się' : 'Chcesz założyć konto dla salonu? Zarejestruj się'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-amber-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-amber-500/30 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">{salonName || 'Panel Salonu'}</h1>
            <p className="text-xs text-zinc-400">Zalogowano jako: {user.email}</p>
          </div>
          <button onClick={handleLogout} className="bg-red-950/60 border border-red-500/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-900/60 transition-colors">
            Wyloguj
          </button>
        </div>

        <div className="flex space-x-6 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`text-sm font-semibold pb-1 transition-all ${
              activeTab === 'appointments' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-zinc-500 hover:text-amber-200'
            }`}
          >
            Rezerwacje
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`text-sm font-semibold pb-1 transition-all ${
              activeTab === 'settings' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-zinc-500 hover:text-amber-200'
            }`}
          >
            Ustawienia Salonu
          </button>
        </div>

        {activeTab === 'appointments' && (
          <div>
            {loadingData ? (
              <p className="text-amber-200 text-sm">Wczytywanie rezerwacji...</p>
            ) : appointments.length === 0 ? (
              <p className="text-zinc-500 text-sm">Brak aktywnych rezerwacji dla Twojego salonu.</p>
            ) : (
              <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-amber-500/30 text-amber-400 uppercase text-xs">
                      <th className="p-3">Klient</th>
                      <th className="p-3">Usługa</th>
                      <th className="p-3">Data</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Telefon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {appointments.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/50">
                        <td className="p-3 font-semibold text-amber-300">{item.client_name || '-'}</td>
                        <td className="p-3">{SERVICES_MAP[item.service_id] || item.service_id}</td>
                        <td className="p-3 text-amber-100">{item.start_time}</td>
                        <td className="p-3 text-zinc-400">{item.client_email || '-'}</td>
                        <td className="p-3 text-zinc-400">{item.client_phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 max-w-xl space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-amber-400">Konfiguracja Salonu & Konta</h2>

            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nazwa Salonu</label>
              <input
                type="text"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">E-mail Powiadomień</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nowe Hasło (Zostaw puste, jeśli nie zmieniasz)</label>
              <input
                type="password"
                placeholder="Wpisz nowe hasło..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Szablon WhatsApp</label>
              <textarea
                rows={3}
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors"
            >
              {savingSettings ? 'Zapisywanie...' : 'Zapisz Ustawienia'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
