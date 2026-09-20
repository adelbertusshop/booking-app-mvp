'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface Appointment {
  id: number | string;
  client_name: string;
  client_email: string;
  client_phone: string;
  start_time: string;
  service_id: number | string | null;
  status: string;
}

interface Service {
  id: string | number;
  name: string;
  duration_minutes: number;
  price?: number;
}

interface SalonHour {
  id?: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_working: boolean;
}

const DAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

const DEFAULT_HOURS: SalonHour[] = DAY_NAMES.map((_, i) => ({
  day_of_week: i,
  open_time: '09:00',
  close_time: '18:00',
  is_working: i < 5,
}));

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [salonNameReg, setSalonNameReg] = useState('');
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<'appointments' | 'services' | 'hours' | 'settings'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<SalonHour[]>(DEFAULT_HOURS);
  const [loadingData, setLoadingData] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('60');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [addingService, setAddingService] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadSalonData(session.user); }
      setLoadingAuth(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); loadSalonData(session.user); }
      else { setUser(null); setSalonId(null); }
      setLoadingAuth(false);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const loadSalonData = async (currentUser: any) => {
    setLoadingData(true);
    let { data: salon } = await supabase.from('salons').select('*').eq('user_id', currentUser.id).single();
    if (!salon) {
      const { data: newSalon } = await supabase.from('salons')
        .insert([{ user_id: currentUser.id, admin_email: currentUser.email || '', salon_name: 'Mój Salon' }])
        .select().single();
      if (newSalon) salon = newSalon;
    }
    if (salon) {
      setSalonId(salon.id);
      setSalonName(salon.salon_name || 'Mój Salon');
      setAdminEmail(salon.admin_email || currentUser.email || '');
      setWhatsappTemplate(salon.whatsapp_template || 'Cześć {NAME}! Przypominamy o wizycie: {SERVICE} w dniu {DATE} o godz. {TIME}. Do zobaczenia!');
      await fetchAppointments(salon.id);
      await fetchServices(salon.id);
      await fetchHours(salon.id);
    }
    setLoadingData(false);
  };

  const fetchAppointments = async (sid: string) => {
    const { data } = await supabase.from('appointments').select('*').eq('salon_id', sid)
      .neq('status', 'cancelled').order('start_time', { ascending: true });
    if (data) setAppointments(data as Appointment[]);
  };

  const fetchServices = async (sid: string) => {
    const { data } = await supabase.from('services').select('*').eq('salon_id', sid).order('name', { ascending: true });
    if (data) setServices(data as Service[]);
  };

  const fetchHours = async (sid: string) => {
    const { data } = await supabase.from('salon_hours').select('*').eq('salon_id', sid).order('day_of_week');
    if (data && data.length === 7) {
      setHours(data as SalonHour[]);
    } else {
      // Ustaw domyślne jeśli brak
      setHours(DEFAULT_HOURS);
    }
  };

  const handleSaveHours = async () => {
    if (!salonId) return;
    setSavingHours(true);

    // Usuń stare i wstaw nowe
    await supabase.from('salon_hours').delete().eq('salon_id', salonId);
    const toInsert = hours.map((h) => ({
      salon_id: salonId,
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_working: h.is_working,
    }));
    const { error } = await supabase.from('salon_hours').insert(toInsert);
    if (error) alert('Błąd zapisu: ' + error.message);
    else alert('✅ Godziny pracy zapisane!');
    setSavingHours(false);
  };

  const updateHour = (dayIndex: number, field: keyof SalonHour, value: any) => {
    setHours((prev) => prev.map((h) => h.day_of_week === dayIndex ? { ...h, [field]: value } : h));
  };

  const handleDeleteAppointment = async (appt: Appointment) => {
    if (!confirm(`Usunąć rezerwację: ${appt.client_name}?`)) return;
    setDeletingId(appt.id);
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
    if (appt.client_email) {
      const serviceName = getServiceName(appt.service_id);
      const date = appt.start_time ? new Date(appt.start_time).toLocaleDateString('pl-PL') : '-';
      const time = appt.start_time ? new Date(appt.start_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-';
      await fetch('/api/send-cancel-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: appt.client_email, clientName: appt.client_name, serviceName, date, time, salonName }),
      }).catch(console.error);
    }
    setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
    setDeletingId(null);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || !newServiceName.trim()) return;
    setAddingService(true);
    const { data, error } = await supabase.from('services')
      .insert([{ salon_id: salonId, name: newServiceName.trim(), duration_minutes: parseInt(newServiceDuration), price: newServicePrice ? parseFloat(newServicePrice) : null }])
      .select().single();
    if (error) alert('Błąd: ' + error.message);
    else if (data) { setServices((prev) => [...prev, data as Service]); setNewServiceName(''); setNewServiceDuration('60'); setNewServicePrice(''); }
    setAddingService(false);
  };

  const handleDeleteService = async (id: string | number) => {
    if (!confirm('Usunąć tę usługę?')) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) alert('Błąd: ' + error.message);
    else setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isRegistering) {
      if (!salonNameReg.trim()) { setError('Podaj nazwę salonu.'); return; }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: password.trim() });
      if (error) { setError(error.message); return; }
      if (data?.user) {
        await supabase.from('salons').insert([{ user_id: data.user.id, admin_email: email.trim(), salon_name: salonNameReg.trim(), whatsapp_template: 'Cześć {NAME}! Przypominamy o wizycie: {SERVICE} w dniu {DATE} o godz. {TIME}. Do zobaczenia!' }]);
        alert('Konto zarejestrowane! Zaloguj się.');
        setIsRegistering(false); setSalonNameReg('');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
      if (error) setError('Nieprawidłowy e-mail lub hasło.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    if (newPassword.trim().length > 0) {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) { alert('Błąd zmiany hasła: ' + error.message); setSavingSettings(false); return; }
      setNewPassword('');
    }
    if (salonId) {
      const { error } = await supabase.from('salons').update({ salon_name: salonName, admin_email: adminEmail, whatsapp_template: whatsappTemplate }).eq('id', salonId);
      if (error) alert('Błąd zapisu: ' + error.message);
      else alert('✅ Ustawienia zapisane!');
    }
    setSavingSettings(false);
  };

  const getServiceName = (serviceId: string | number | null) => {
    if (!serviceId) return 'Wizyta';
    const s = services.find((srv) => String(srv.id) === String(serviceId));
    return s ? s.name : `Usługa #${serviceId}`;
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  if (loadingAuth) return <main className="min-h-screen bg-black flex items-center justify-center"><p className="text-amber-400 font-bold animate-pulse">Ładowanie...</p></main>;

  if (!user) return (
    <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
      <form onSubmit={handleAuth} className="bg-zinc-950 border border-amber-500/30 p-8 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
        <h1 className="text-xl font-bold text-amber-400 text-center">{isRegistering ? '🏪 Rejestracja Salonu' : '🔐 Logowanie do Panelu'}</h1>
        {error && <p className="text-red-400 text-xs text-center bg-red-950/40 border border-red-500/30 p-2 rounded-lg">{error}</p>}
        {isRegistering && (
          <div>
            <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nazwa Salonu</label>
            <input type="text" placeholder="np. Salon Klaudia" value={salonNameReg} onChange={(e) => setSalonNameReg(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400" required />
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-amber-300 uppercase mb-1">E-mail</label>
          <input type="email" placeholder="admin@salon.pl" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400" required />
        </div>
        <div>
          <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Hasło</label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 pr-16 text-amber-100 text-sm focus:outline-none focus:border-amber-400" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 text-xs font-bold">
              {showPassword ? 'UKRYJ' : 'POKAŻ'}
            </button>
          </div>
        </div>
        <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors">
          {isRegistering ? 'Zarejestruj Salon' : 'Zaloguj się'}
        </button>
        <button type="button" onClick={() => { setError(''); setSalonNameReg(''); setIsRegistering(!isRegistering); }}
          className="w-full text-xs text-amber-400/80 hover:text-amber-300 text-center block pt-1">
          {isRegistering ? 'Masz już konto? Zaloguj się' : 'Nowy salon? Zarejestruj się tutaj'}
        </button>
      </form>
    </main>
  );

  return (
    <main className="min-h-screen bg-black text-amber-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-amber-500/30 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">{salonName || 'Panel Salonu'}</h1>
            <p className="text-xs text-zinc-400">{user.email}</p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => setUser(null))}
            className="bg-red-950/60 border border-red-500/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-900/60 transition-colors">
            Wyloguj
          </button>
        </div>

        <div className="flex space-x-4 border-b border-zinc-800 pb-2 overflow-x-auto">
          {(['appointments', 'services', 'hours', 'settings'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`text-sm font-semibold pb-1 whitespace-nowrap transition-all ${activeTab === tab ? 'text-amber-400 border-b-2 border-amber-400' : 'text-zinc-500 hover:text-amber-200'}`}>
              {tab === 'appointments' ? '📅 Rezerwacje' : tab === 'services' ? '✂️ Usługi' : tab === 'hours' ? '🕐 Godziny pracy' : '⚙️ Ustawienia'}
            </button>
          ))}
        </div>

        {/* REZERWACJE */}
        {activeTab === 'appointments' && (
          <div>
            {loadingData ? <p className="text-amber-200 text-sm animate-pulse">Wczytywanie...</p>
              : appointments.length === 0 ? (
                <div className="text-center py-12 text-zinc-500"><p className="text-4xl mb-3">📭</p><p className="text-sm">Brak aktywnych rezerwacji.</p></div>
              ) : (
                <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl overflow-x-auto">
                  <p className="text-xs text-zinc-400 mb-4">Łącznie: <span className="text-amber-400 font-bold">{appointments.length}</span></p>
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-amber-500/30 text-amber-400 uppercase text-xs">
                        <th className="p-3">Klient</th><th className="p-3">Usługa</th><th className="p-3">Termin</th><th className="p-3">Email</th><th className="p-3">Tel</th><th className="p-3 text-center">Akcja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {appointments.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-900/50 transition-colors">
                          <td className="p-3 font-semibold text-amber-300">{item.client_name || '-'}</td>
                          <td className="p-3 text-zinc-300">{getServiceName(item.service_id)}</td>
                          <td className="p-3 text-amber-100 whitespace-nowrap">{formatDate(item.start_time)}</td>
                          <td className="p-3 text-zinc-400 text-xs">{item.client_email || '-'}</td>
                          <td className="p-3 text-zinc-400 text-xs">{item.client_phone || '-'}</td>
                          <td className="p-3 text-center">
                            <button onClick={() => handleDeleteAppointment(item)} disabled={deletingId === item.id}
                              className="bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                              {deletingId === item.id ? '...' : '🗑 Usuń'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}

        {/* USŁUGI */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-amber-400 mb-4">➕ Dodaj usługę</h2>
              <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input type="text" placeholder="Nazwa usługi" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)}
                  className="md:col-span-2 bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400" required />
                <input type="number" placeholder="Czas (min)" value={newServiceDuration} onChange={(e) => setNewServiceDuration(e.target.value)} min="15" step="15"
                  className="bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400" required />
                <input type="number" placeholder="Cena PLN" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} min="0" step="0.01"
                  className="bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400" />
                <button type="submit" disabled={addingService}
                  className="md:col-span-4 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                  {addingService ? 'Dodawanie...' : 'Dodaj usługę'}
                </button>
              </form>
            </div>
            <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-amber-400 mb-4">📋 Twoje usługi ({services.length})</h2>
              {services.length === 0 ? <p className="text-zinc-500 text-sm text-center py-6">Brak usług.</p> : (
                <div className="space-y-2">
                  {services.map((srv) => (
                    <div key={srv.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                      <div>
                        <span className="font-semibold text-amber-200 text-sm">{srv.name}</span>
                        <span className="text-zinc-500 text-xs ml-3">⏱ {srv.duration_minutes} min</span>
                        {srv.price && <span className="text-zinc-400 text-xs ml-3">💰 {srv.price} PLN</span>}
                      </div>
                      <button onClick={() => handleDeleteService(srv.id)}
                        className="text-red-400 hover:text-red-300 text-xs font-bold border border-red-500/30 px-2 py-1 rounded transition-colors">Usuń</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GODZINY PRACY */}
        {activeTab === 'hours' && (
          <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-amber-400">🕐 Godziny pracy salonu</h2>
            <p className="text-xs text-zinc-500">Ustaw godziny dla każdego dnia. Klienci zobaczą tylko dostępne terminy.</p>
            <div className="space-y-3">
              {hours.map((h) => (
                <div key={h.day_of_week} className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border transition-all ${h.is_working ? 'bg-zinc-900 border-amber-500/20' : 'bg-zinc-950 border-zinc-800 opacity-60'}`}>
                  <div className="flex items-center gap-3 w-36">
                    <input type="checkbox" checked={h.is_working} onChange={(e) => updateHour(h.day_of_week, 'is_working', e.target.checked)}
                      className="w-4 h-4 accent-amber-500 cursor-pointer" />
                    <span className={`text-sm font-semibold ${h.is_working ? 'text-amber-200' : 'text-zinc-500'}`}>
                      {DAY_NAMES[h.day_of_week]}
                    </span>
                  </div>
                  {h.is_working ? (
                    <div className="flex items-center gap-2">
                      <select value={h.open_time} onChange={(e) => updateHour(h.day_of_week, 'open_time', e.target.value)}
                        className="bg-zinc-800 border border-amber-500/20 rounded-lg px-3 py-1.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400">
                        {['06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="text-zinc-500 text-xs">do</span>
                      <select value={h.close_time} onChange={(e) => updateHour(h.day_of_week, 'close_time', e.target.value)}
                        className="bg-zinc-800 border border-amber-500/20 rounded-lg px-3 py-1.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400">
                        {['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-xs italic">Dzień wolny</span>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSaveHours} disabled={savingHours}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {savingHours ? 'Zapisywanie...' : 'Zapisz godziny pracy'}
            </button>
          </div>
        )}

        {/* USTAWIENIA */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 max-w-xl space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-amber-400">⚙️ Konfiguracja Salonu</h2>
            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nazwa Salonu</label>
              <input type="text" value={salonName} onChange={(e) => setSalonName(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">E-mail Powiadomień</label>
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nowe Hasło</label>
              <div className="relative">
                <input type={showNewPassword ? 'text' : 'password'} placeholder="Zostaw puste jeśli nie zmieniasz"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 pr-16 text-amber-100 text-sm focus:outline-none focus:border-amber-400" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 text-xs font-bold">
                  {showNewPassword ? 'UKRYJ' : 'POKAŻ'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Szablon WhatsApp</label>
              <textarea rows={3} value={whatsappTemplate} onChange={(e) => setWhatsappTemplate(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400" />
              <p className="text-xs text-zinc-500 mt-1">Zmienne: {'{NAME}'}, {'{SERVICE}'}, {'{DATE}'}, {'{TIME}'}</p>
            </div>
            <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-400 font-bold mb-1">🔗 Link dla klientów:</p>
              <p className="text-xs text-zinc-400 break-all">
                {typeof window !== 'undefined' ? window.location.origin : 'https://booking-app-mvp.vercel.app'}/salon/{salonId || 'twoje-id'}
              </p>
            </div>
            <button type="submit" disabled={savingSettings}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {savingSettings ? 'Zapisywanie...' : 'Zapisz Ustawienia'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
