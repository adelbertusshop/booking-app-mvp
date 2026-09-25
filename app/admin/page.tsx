'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c: string) => ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'} as any)[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildWhatsAppLink(
  phone: string,
  template: string,
  name: string,
  service: string,
  date: string,
  time: string
): string | null {
  if (!phone) return null;
  // Oczyść numer
  let cleaned = phone.replace(/[\s+()\-]/g, '');
  // Usuń wiodące zera
  cleaned = cleaned.replace(/^0+/, '');
  // Dodaj prefix 48 jeśli nie ma
  if (!cleaned.startsWith('48')) cleaned = '48' + cleaned;
  if (!/^\d{10,13}$/.test(cleaned)) return null;

  const message = template
    .replace('{NAME}', name)
    .replace('{SERVICE}', service)
    .replace('{DATE}', date)
    .replace('{TIME}', time);

  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'appointments' | 'services' | 'hours' | 'notifications' | 'settings'>('dashboard');
  const [showRevenue, setShowRevenue] = useState<boolean>(false);
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [statsToday, setStatsToday] = useState<Appointment[]>([]);
  const [statsMonthCount, setStatsMonthCount] = useState<number>(0);
  const [statsTopService, setStatsTopService] = useState<string>('—');
  const [statsRevenue, setStatsRevenue] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [monthReservationCount, setMonthReservationCount] = useState<number>(0);
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  });
  const [calAppts, setCalAppts] = useState<Appointment[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [loadingCal, setLoadingCal] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<SalonHour[]>(DEFAULT_HOURS);
  const [loadingData, setLoadingData] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonSlug, setSalonSlug] = useState<string>('');
  const [salonName, setSalonName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaveStatus, setEmailSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
      setSalonSlug(salon.slug || '');
      setShowRevenue(salon.show_revenue || false);
      setIsPublic(salon.is_public || false);
      setAdminEmail(salon.admin_email || currentUser.email || '');
      setWhatsappTemplate(salon.whatsapp_template || 'Cześć {NAME}! Przypominamy o wizycie: {SERVICE} w dniu {DATE} o godz. {TIME}. Do zobaczenia!');
      await fetchAppointments(salon.id);
      await fetchServices(salon.id);
      await fetchHours(salon.id);
      await fetchStats(salon.id, salon.show_revenue || false);
      const wd = new Date();
      const diff = wd.getDay() === 0 ? -6 : 1 - wd.getDay();
      wd.setDate(wd.getDate() + diff);
      wd.setHours(0,0,0,0);
      await fetchCalendar(salon.id, wd);
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

  const fetchStats = async (sid: string, withRevenue: boolean) => {
    setLoadingStats(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Rezerwacje na dziś
    const { data: todayData } = await supabase
      .from('appointments')
      .select('*')
      .eq('salon_id', sid)
      .neq('status', 'cancelled')
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd)
      .order('start_time', { ascending: true });
    setStatsToday((todayData as Appointment[]) || []);

    // Rezerwacje w tym miesiącu
    const { data: monthData } = await supabase
      .from('appointments')
      .select('service_id')
      .eq('salon_id', sid)
      .neq('status', 'cancelled')
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd);

    const mCount = (monthData || []).length;
    setStatsMonthCount(mCount);
    setMonthReservationCount(mCount);

    // Najpopularniejsza usługa
    const withService = (monthData || []).filter((a: any) => a.service_id);
    if (withService.length > 0) {
      const counts: Record<string, number> = {};
      withService.forEach((a: any) => {
        counts[a.service_id] = (counts[a.service_id] || 0) + 1;
      });
      const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      const { data: svcData } = await supabase.from('services').select('name').eq('id', topId).single();
      setStatsTopService(svcData?.name || '—');
    } else {
      setStatsTopService('—');
    }

    // Przychód (opcjonalny)
    if (withRevenue) {
      const { data: revenueData } = await supabase
        .from('appointments')
        .select('service_id, services(price)')
        .eq('salon_id', sid)
        .neq('status', 'cancelled')
        .gte('start_time', monthStart)
        .lte('start_time', monthEnd)
        .not('service_id', 'is', null);

      const total = (revenueData || []).reduce((sum: number, a: any) => {
        const price = a.services?.price;
        return price ? sum + Number(price) : sum;
      }, 0);
      setStatsRevenue(total);
    }

    setLoadingStats(false);
  };

  const fetchCalendar = async (sid: string, start: Date) => {
    setLoadingCal(true);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('salon_id', sid)
      .neq('status', 'cancelled')
      .gte('start_time', start.toISOString())
      .lt('start_time', end.toISOString())
      .order('start_time', { ascending: true });
    setCalAppts((data as Appointment[]) || []);
    setLoadingCal(false);
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
    try {
      // cancel-booking używa SERVICE_ROLE - omija RLS
      const res = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appt.id, email: appt.client_email || '' }),
      });
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Błąd usuwania: ' + (err.error || 'Spróbuj ponownie'));
      }
    } catch {
      alert('Błąd połączenia. Spróbuj ponownie.');
    }
    setDeletingId(null);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || !newServiceName.trim()) return;
    if (services.length >= 10) {
      alert('Osiągnięto limit 10 usług w planie FREE. Usuń istniejącą usługę, aby dodać nową.');
      return;
    }
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
        await supabase.from('salons').insert([{ user_id: data.user.id, admin_email: email.trim(), salon_name: salonNameReg.trim(), slug: toSlug(salonNameReg.trim()), whatsapp_template: 'Cześć {NAME}! Przypominamy o wizycie: {SERVICE} w dniu {DATE} o godz. {TIME}. Do zobaczenia!' }]);
        alert('Konto zarejestrowane! Zaloguj się.');
        setIsRegistering(false); setSalonNameReg('');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
      if (error) setError('Nieprawidłowy e-mail lub hasło.');
    }
  };

  const handleSaveEmail = async () => {
    if (!salonId || !adminEmail.trim()) return;
    setSavingEmail(true);
    setEmailSaveStatus('idle');
    const { error } = await supabase
      .from('salons')
      .update({ admin_email: adminEmail.trim() })
      .eq('id', salonId);
    if (error) {
      setEmailSaveStatus('error');
    } else {
      setEmailSaveStatus('success');
      setTimeout(() => setEmailSaveStatus('idle'), 4000);
    }
    setSavingEmail(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    if (newPassword.trim().length >= 6) {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) {
        alert('Błąd zmiany hasła: ' + error.message);
        setSavingSettings(false);
        return;
      }
      setNewPassword('');
      setNewPassword('');
    }
    if (salonId) {
      const { error } = await supabase.from('salons').update({ salon_name: salonName, admin_email: adminEmail, whatsapp_template: whatsappTemplate, show_revenue: showRevenue, is_public: isPublic }).eq('id', salonId);
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
          <label className="block text-xs font-bold text-amber-300 uppercase mb-1">E-mail powiadomień</label>
          <input type="email" placeholder="admin@salon.pl" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
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
          {(['dashboard', 'calendar', 'appointments', 'services', 'hours', 'notifications', 'settings'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`text-sm font-semibold pb-1 transition-all text-center ${activeTab === tab ? 'text-amber-400 border-b-2 border-amber-400' : 'text-zinc-500 hover:text-amber-200'}`}>
              {tab === 'dashboard' ? (
                <span className="text-center leading-tight">📊<br /><span className="text-xs font-black tracking-wider">Dashboard</span></span>
              ) : tab === 'calendar' ? (
                <span className="text-center leading-tight">📆<br /><span className="text-xs font-black tracking-wider">Kalendarz</span></span>
              ) : tab === 'appointments' ? (
                <span className="text-center leading-tight">📅 <span className="font-black tracking-wider">SIŁA</span><br /><span className="text-xs font-normal text-zinc-500">Rezerwacje</span></span>
              ) : tab === 'services' ? (
                <span className="text-center leading-tight">✨ <span className="font-black tracking-wider">CZYSTOŚĆ</span><br /><span className="text-xs font-normal text-zinc-500">Usługi</span></span>
              ) : tab === 'hours' ? (
                <span className="text-center leading-tight">🕐<br /><span className="text-xs font-black tracking-wider">Godziny pracy</span></span>
              ) : tab === 'notifications' ? (
                <span className="text-center leading-tight">💡 <span className="font-black tracking-wider">ŚWIATŁO</span><br /><span className="text-xs font-normal text-zinc-500">Powiadomienia</span></span>
              ) : (
                <span className="text-center leading-tight">⚙️ <span className="font-black tracking-wider">WŁADZA</span><br /><span className="text-xs font-normal text-zinc-500">Konfiguracja</span></span>
              )}
            </button>
          ))}
        </div>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {loadingStats ? (
              <p className="text-amber-200 text-sm animate-pulse">Wczytywanie statystyk...</p>
            ) : (
              <>
                {/* Baner limitu FREE */}
                {monthReservationCount >= 45 && (
                  <div className={`rounded-xl border px-5 py-4 flex items-start gap-3 ${
                    monthReservationCount >= 50
                      ? 'bg-red-950/40 border-red-500/50'
                      : 'bg-amber-950/40 border-amber-500/50'
                  }`}>
                    <span className="text-xl flex-shrink-0">{monthReservationCount >= 50 ? '🔒' : '⚠️'}</span>
                    <div>
                      <p className={`text-sm font-bold ${monthReservationCount >= 50 ? 'text-red-400' : 'text-amber-400'}`}>
                        {monthReservationCount >= 50
                          ? 'Limit FREE został osiągnięty'
                          : 'Zbliżasz się do limitu FREE'}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Wykorzystano <strong>{monthReservationCount} z 50</strong> rezerwacji w tym miesiącu.
                        {monthReservationCount >= 50 && ' Klienci nie mogą teraz rezerwować przez LUMAR.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Rezerwacje w tym miesiącu */}
                  <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-5">
                    <p className="text-xs text-zinc-400 uppercase font-bold mb-1">📅 Ten miesiąc</p>
                    <p className="text-4xl font-black text-amber-400">{statsMonthCount}</p>
                    <p className="text-xs text-zinc-500 mt-1">rezerwacji</p>
                  </div>
                  {/* Najpopularniejsza usługa */}
                  <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-5">
                    <p className="text-xs text-zinc-400 uppercase font-bold mb-1">✨ Najpopularniejsza</p>
                    <p className="text-lg font-bold text-amber-200 mt-2 leading-tight">{statsTopService}</p>
                    <p className="text-xs text-zinc-500 mt-1">usługa w tym miesiącu</p>
                  </div>
                  {/* Przychód - opcjonalny */}
                  {showRevenue && (
                    <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-5">
                      <p className="text-xs text-zinc-400 uppercase font-bold mb-1">💰 Przychód</p>
                      <p className="text-4xl font-black text-amber-400">{statsRevenue} <span className="text-lg font-normal">PLN</span></p>
                      <p className="text-xs text-zinc-500 mt-1">z rezerwacji w tym miesiącu</p>
                    </div>
                  )}
                </div>

                {/* Grafik na dziś */}
                <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-5">
                  <p className="text-sm font-bold text-amber-400 mb-3">🕐 Grafik na dziś</p>
                  {statsToday.length === 0 ? (
                    <p className="text-zinc-500 text-sm">Brak rezerwacji na dziś.</p>
                  ) : (
                    <div className="space-y-2">
                      {statsToday.map((appt) => {
                        const time = appt.start_time ? new Date(appt.start_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—';
                        const svcName = services.find(s => String(s.id) === String(appt.service_id))?.name || 'Wizyta';
                        return (
                          <div key={appt.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5">
                            <span className="text-amber-400 font-bold text-sm w-12">{time}</span>
                            <span className="text-amber-200 text-sm font-semibold">{appt.client_name}</span>
                            <span className="text-zinc-400 text-xs ml-auto">{svcName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* KALENDARZ */}
        {activeTab === 'calendar' && (
          <div className="space-y-3">
            {/* Nawigacja tygodnia */}
            <div className="flex items-center justify-between">
              <button onClick={() => {
                const prev = new Date(weekStart);
                prev.setDate(prev.getDate() - 7);
                setWeekStart(prev);
                if (salonId) fetchCalendar(salonId, prev);
              }} className="bg-zinc-900 border border-amber-500/30 text-amber-300 px-4 py-2 rounded-lg text-xs font-bold hover:border-amber-400 transition-colors">
                ← Poprzedni
              </button>
              <span className="text-amber-400 font-bold text-sm">
                {weekStart.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long' })} — {new Date(weekStart.getTime() + 6*86400000).toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => {
                const next = new Date(weekStart);
                next.setDate(next.getDate() + 7);
                setWeekStart(next);
                if (salonId) fetchCalendar(salonId, next);
              }} className="bg-zinc-900 border border-amber-500/30 text-amber-300 px-4 py-2 rounded-lg text-xs font-bold hover:border-amber-400 transition-colors">
                Następny →
              </button>
            </div>

            {loadingCal ? (
              <p className="text-amber-200 text-sm animate-pulse text-center py-8">Ładowanie kalendarza...</p>
            ) : (
              <div className="bg-zinc-950 border border-amber-500/20 rounded-2xl overflow-hidden">
                {/* Popup szczegółów */}
                {selectedAppt && (
                  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAppt(null)}>
                    <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
                      <h3 className="text-amber-400 font-bold text-lg">{selectedAppt.client_name}</h3>
                      <div className="space-y-2 text-sm">
                        <p className="text-zinc-300">✂️ {services.find(s => String(s.id) === String(selectedAppt.service_id))?.name || 'Wizyta'}</p>
                        <p className="text-zinc-300">🕐 {new Date(selectedAppt.start_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-zinc-300">📧 {selectedAppt.client_email || '—'}</p>
                        <p className="text-zinc-300">📞 {selectedAppt.client_phone || '—'}</p>
                      </div>
                      <button onClick={() => setSelectedAppt(null)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-lg text-sm font-bold transition-colors mt-2">Zamknij</button>
                    </div>
                  </div>
                )}

                {/* Grid kalendarza */}
                <div className="overflow-x-auto">
                  <div style={{ minWidth: '700px' }}>
                    {/* Nagłówek dni */}
                    <div className="grid border-b border-zinc-800" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                      <div className="p-2" />
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(weekStart.getTime() + i * 86400000);
                        const isToday = d.toDateString() === new Date().toDateString();
                        return (
                          <div key={i} className={`p-2 text-center border-l border-zinc-800 ${isToday ? 'bg-amber-500/10' : ''}`}>
                            <p className="text-xs text-zinc-500 uppercase">{d.toLocaleDateString('pl-PL', { weekday: 'short' })}</p>
                            <p className={`text-sm font-bold ${isToday ? 'text-amber-400' : 'text-zinc-300'}`}>{d.getDate()}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Wiersze godzin 8:00-18:00 */}
                    {Array.from({ length: 21 }, (_, hi) => {
                      const hour = Math.floor(hi / 2) + 8;
                      const min = hi % 2 === 0 ? '00' : '30';
                      const slotLabel = hi % 2 === 0 ? `${String(hour).padStart(2,'0')}:00` : '';
                      const slotTime = `${String(hour).padStart(2,'0')}:${min}`;

                      return (
                        <div key={hi} className="grid border-b border-zinc-800/50" style={{ gridTemplateColumns: '52px repeat(7, 1fr)', minHeight: '36px' }}>
                          <div className="px-1 py-0.5 text-right">
                            <span className="text-xs text-zinc-600">{slotLabel}</span>
                          </div>
                          {Array.from({ length: 7 }, (_, di) => {
                            const cellDate = new Date(weekStart.getTime() + di * 86400000);
                            const cellAppts = calAppts.filter(a => {
                              const at = new Date(a.start_time);
                              return at.toDateString() === cellDate.toDateString() &&
                                at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) === slotTime;
                            });
                            const isToday = cellDate.toDateString() === new Date().toDateString();
                            return (
                              <div key={di} className={`border-l border-zinc-800/50 px-0.5 py-0.5 ${isToday ? 'bg-amber-500/5' : ''}`}>
                                {cellAppts.map(a => (
                                  <button key={a.id} onClick={() => setSelectedAppt(a)}
                                    className="w-full text-left bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 rounded px-1.5 py-1 text-xs text-amber-200 font-semibold truncate transition-colors">
                                    {a.client_name}
                                  </button>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
                          <td className="p-3 text-xs">
                          {(() => {
                            if (!item.client_phone) return <span className="text-zinc-600">—</span>;
                            const svcName = getServiceName(item.service_id);
                            const apptDate = item.start_time ? new Date(item.start_time).toLocaleDateString('pl-PL') : '—';
                            const apptTime = item.start_time ? new Date(item.start_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—';
                            const waLink = buildWhatsAppLink(item.client_phone, whatsappTemplate, item.client_name || '', svcName, apptDate, apptTime);
                            if (!waLink) return <span className="text-zinc-400">{item.client_phone}</span>;
                            return (
                              <a href={waLink} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-green-400 hover:text-green-300 font-semibold transition-colors"
                                title="Wyślij wiadomość WhatsApp">
                                <span>📱</span>
                                <span>{item.client_phone}</span>
                              </a>
                            );
                          })()}
                        </td>
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
              <div className="mb-4"><p className="text-xs font-black tracking-widest text-amber-500 uppercase">✨ CZYSTOŚĆ</p><h2 className="text-lg font-bold text-amber-400">➕ Dodaj usługę</h2></div>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-amber-400">📋 Twoje usługi</h2>
                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                  services.length >= 10
                    ? 'text-red-400 border-red-500/40 bg-red-950/30'
                    : services.length >= 8
                    ? 'text-amber-400 border-amber-500/40 bg-amber-950/30'
                    : 'text-zinc-400 border-zinc-700 bg-zinc-900'
                }`}>{services.length}/10 FREE</span>
              </div>
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

        {/* ŚWIATŁO - POWIADOMIENIA */}
        {activeTab === 'notifications' && (
          <div className="space-y-4 max-w-xl">
            <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
              <div>
                <p className="text-xs font-black tracking-widest text-amber-500 uppercase">💡 ŚWIATŁO</p>
                <h2 className="text-lg font-bold text-amber-400">Powiadomienia</h2>
              </div>

              {/* Email powiadomień */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-amber-300 uppercase">E-mail powiadomień</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => { setAdminEmail(e.target.value); setEmailSaveStatus('idle'); }}
                    placeholder="adres@salonu.pl"
                    className="flex-1 bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={handleSaveEmail}
                    disabled={savingEmail}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-xs transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {savingEmail ? '...' : 'Zmień adres'}
                  </button>
                </div>
                {emailSaveStatus === 'success' && (
                  <p className="text-xs text-green-400 font-semibold">✅ Adres e-mail zapisany. Nowe powiadomienia będą wysyłane na ten adres.</p>
                )}
                {emailSaveStatus === 'error' && (
                  <p className="text-xs text-red-400 font-semibold">❌ Błąd zapisu. Spróbuj ponownie.</p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-amber-300 uppercase">Status</label>
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                  <span className="text-green-400 text-lg">🟢</span>
                  <span className="text-sm font-semibold text-green-400">Powiadomienia aktywne</span>
                </div>
              </div>

              {/* Aktywne typy */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-amber-300 uppercase">Aktywne typy</label>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 space-y-2">
                  {[
                    { label: 'Nowa rezerwacja', desc: 'Email gdy klient zarezerwuje wizytę' },
                    { label: 'Odwołanie rezerwacji', desc: 'Email gdy rezerwacja zostanie usunięta' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <input type="checkbox" checked disabled className="w-4 h-4 mt-0.5 accent-amber-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-200">{item.label}</p>
                        <p className="text-xs text-zinc-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-600">Więcej typów powiadomień dostępnych w planie PRO.</p>
              </div>
            </div>
          </div>
        )}

        {/* GODZINY PRACY */}
        {activeTab === 'hours' && (
          <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div><p className="text-xs font-black tracking-widest text-amber-500 uppercase">🕐 RYTM</p><h2 className="text-lg font-bold text-amber-400">Godziny pracy salonu</h2></div>
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
            <div><p className="text-xs font-black tracking-widest text-amber-500 uppercase">⚙️ WŁADZA</p><h2 className="text-lg font-bold text-amber-400">Konfiguracja Salonu</h2></div>
            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nazwa Salonu</label>
              <input type="text" value={salonName} onChange={(e) => setSalonName(e.target.value)}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">📧 Adres e-mail powiadomień zarządzasz w zakładce <span className="text-amber-400 font-bold">💡 ŚWIATŁO</span></p>
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nowe Hasło</label>
              <div className="relative">
                <input type={showNewPassword ? 'text' : 'password'} placeholder="Zostaw puste jeśli nie zmieniasz"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
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
            <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-amber-300 uppercase">📊 Statystyki panelu</p>
              {[
                { key: 'month', label: 'Rezerwacje w tym miesiącu', locked: true },
                { key: 'top', label: 'Najpopularniejsza usługa', locked: true },
                { key: 'today', label: 'Dzisiejszy grafik', locked: true },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-2">
                  <input type="checkbox" checked={true} disabled className="w-4 h-4 accent-amber-500" />
                  <span className="text-xs text-zinc-400">{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={showRevenue} onChange={(e) => setShowRevenue(e.target.checked)} className="w-4 h-4 accent-amber-500 cursor-pointer" />
                <span className="text-xs text-zinc-300 cursor-pointer" onClick={() => setShowRevenue(!showRevenue)}>💰 Przychód (suma cen zarezerwowanych usług)</span>
              </div>
            </div>
            <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-amber-300 uppercase">🌐 Widoczność w katalogu LUMAR</p>
              <div className="flex items-start gap-3 pt-1">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-amber-500 cursor-pointer flex-shrink-0"
                />
                <label htmlFor="is_public" className="text-xs text-zinc-300 cursor-pointer leading-relaxed">
                  <span className="font-bold text-amber-200">Pokaż mój salon w katalogu LUMAR</span><br />
                  <span className="text-zinc-500">Gdy aktywne — Twój salon pojawi się na stronie /salony. Klienci będą mogli Cię znaleźć przez katalog.</span>
                </label>
              </div>
            </div>
            <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-400 font-bold mb-1">🔗 Link dla klientów:</p>
              <p className="text-xs text-zinc-400 break-all">
                {typeof window !== 'undefined' ? window.location.origin : 'https://booking-app-mvp.vercel.app'}/salon/{salonSlug || salonId || 'twoje-id'}
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
