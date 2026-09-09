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
  
  // Stany formularza auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Stany panelu
  const [activeTab, setActiveTab] = useState<'appointments' | 'settings'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  // Stany ustawień salonu
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    // Sprawdzenie aktywnej sesji Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadSalonData(session.user.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadSalonData(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const loadSalonData = async (userId: string) => {
    setLoading(true);
    // Pobranie profilu salonu
    let { data: salon } = await supabase.from('salons').select('*').eq('user_id', userId).single();

    // Jeśli salon nie istnieje, utwórz nowy wiersz
    if (!salon) {
      const { data: newSalon } = await supabase
        .from('salons')
        .insert([{ user_id: userId, admin_email: user?.email || '' }])
        .select()
        .single();
      salon = newSalon;
    }

    if (salon) {
      setSalonId(salon.id);
      setSalonName(salon.salon_name || '');
      setAdminEmail(salon.admin_email || user?.email || '');
      setWhatsappTemplate(salon.whatsapp_template || '');
      fetchAppointments(salon.id);
    }
    setLoading(false);
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
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else alert('Konto zostało utworzone! Możesz się zalogować.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError('Nieprawidłowy e-mail lub hasło.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;
    setSavingSettings(true);

    const { error } = await supabase
      .from('salons')
      .update({
        salon_name: salonName,
        admin_email: adminEmail,
        whatsapp_template: whatsappTemplate,
      })
      .eq('id', salonId);

    setSavingSettings(false);
    if (!error) alert('Ustawienia Twojego salonu zostały zapisane!');
    else alert('Błąd zapisu: ' + error.message);
  };

  const handleLogout = () => supabase.auth.signOut();

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
        <form onSubmit={handleAuth} className="bg-zinc-950 border border-amber-500/30 p-8 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
          <h1 className="text-xl font-bold text-amber-400 text-center">
            {isRegistering ? 'Rejestracja Salonu' : 'Logowanie do Panelu'}
          </h1>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <input
            type="email"
            placeholder="E-mail administratora"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
            required
          />

          <input
            type="password"
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
            required
          />

          <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors">
            {isRegistering ? 'Zarejestruj Salon' : 'Zaloguj się'}
          </button>

          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
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
            <p className="text-xs text-zinc-400">{user.email}</p>
          </div>
          <button onClick={handleLogout} className="bg-red-950/60 border border-red-500/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold">
            Wyloguj
          </button>
        </div>

        <div className="flex space-x-4 border-b border-zinc-800 pb-2">
          <button onClick={() => setActiveTab('appointments')} className={`text-sm font-semibold ${activeTab === 'appointments' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-zinc-500'}`}>
            Rezerwacje
          </button>
          <button onClick={() => setActiveTab('settings')} className={`text-sm font-semibold ${activeTab === 'settings' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-zinc-500'}`}>
            Ustawienia Salonu
          </button>
        </div>

        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 max-w-xl space-y-4">
            <div>
              <label className="block text-xs text-amber-300 uppercase mb-1">Nazwa Salonu</label>
              <input type="text" value={salonName} onChange={(e) => setSalonName(e.target.value)} className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-amber-300 uppercase mb-1">Email Powiadomień</label>
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-amber-300 uppercase mb-1">Szablon WhatsApp</label>
              <textarea rows={3} value={whatsappTemplate} onChange={(e) => setWhatsappTemplate(e.target.value)} className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-sm" />
            </div>
            <button type="submit" disabled={savingSettings} className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg text-sm">
              Zapisz Ustawienia
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
