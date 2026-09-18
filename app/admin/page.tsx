'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Appointment {
  id: number | string;
  client_name: string;
  client_email: string;
  client_phone: string;
  start_time: string;
  service_id: number | string;
  status: string;
}

interface Service {
  id: string | number;
  name: string;
  duration_minutes: number;
  price?: number;
}

interface Salon {
  id: string;
  salon_name: string;
  admin_email: string;
  whatsapp_template: string;
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<'appointments' | 'services' | 'settings'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Nowa usługa
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('60');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [addingService, setAddingService] = useState(false);

  useEffect(() => {
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
        setSalonId(null);
      }
      setLoadingAuth(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const loadSalonData = async (currentUser: any) => {
    setLoadingData(true);

    let { data: salon } = await supabase
      .from('salons')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();

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
          'Cześć {NAME}! Przypominamy o wizycie: {SERVICE} w dniu {DATE} o godz. {TIME}. Do zobaczenia!'
      );
      await fetchAppointments(salon.id);
      await fetchServices(salon.id);
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

  const fetchServices = async (currentSalonId: string) => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('salon_id', currentSalonId)
      .order('name', { ascending: true });

    if (data) setServices(data as Service[]);
  };

  const handleDeleteAppointment = async (id: string | number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę rezerwację?')) return;
    setDeletingId(id);

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      alert('Błąd usuwania rezerwacji: ' + error.message);
    } else {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    }
    setDeletingId(null);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || !newServiceName.trim()) return;
    setAddingService(true);

    const { data, error } = await supabase
      .from('services')
      .insert([{
        salon_id: salonId,
        name: newServiceName.trim(),
        duration_minutes: parseInt(newServiceDuration),
        price: newServicePrice ? parseFloat(newServicePrice) : null,
      }])
      .select()
      .single();

    if (error) {
      alert('Błąd dodawania usługi: ' + error.message);
    } else if (data) {
      setServices((prev) => [...prev, data as Service]);
      setNewServiceName('');
      setNewServiceDuration('60');
      setNewServicePrice('');
    }
    setAddingService(false);
  };

  const handleDeleteService = async (id: string | number) => {
    if (!confirm('Usunąć tę usługę?')) return;

    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) {
      alert('Błąd: ' + error.message);
    } else {
      setServices((prev) => prev.filter((s) => s.id !== id));
    }
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
        alert('Konto zarejestrowane! Możesz się zalogować.');
        setIsRegistering(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) setError('Nieprawidłowy e-mail lub hasło.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    if (newPassword.trim().length > 0) {
      const { error: passErr } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (passErr) {
        alert('Błąd zmiany hasła: ' + passErr.message);
        setSavingSettings(false);
        return;
      }
      setNewPassword('');
    }

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
        alert('Błąd zapisu: ' + salonErr.message);
      } else {
        alert('Ustawienia zapisane!');
      }
    }
    setSavingSettings(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const getServiceName = (serviceId: string | number) => {
    const s = services.find((srv) => String(srv.id) === String(serviceId));
    return s ? s.name : `Usługa #${serviceId}`;
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
            {isRegistering ? '🏪 Rejestracja Salonu' : '🔐 Logowanie do Panelu'}
          </h1>

          {error && <p className="text-red-400 text-xs text-center bg-red-950/40 border border-red-500/30 p-2 rounded-lg">{error}</p>}

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
            onClick={() => { setError(''); setIsRegistering(!isRegistering); }}
            className="w-full text-xs text-amber-400/80 hover:text-amber-300 text-center block pt-2"
          >
            {isRegistering ? 'Masz już konto? Zaloguj się' : 'Nowy salon? Zarejestruj się tutaj'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-amber-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center border-b border-amber-500/30 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">{salonName || 'Panel Salonu'}</h1>
            <p className="text-xs text-zinc-400">Zalogowano jako: {user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-950/60 border border-red-500/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-900/60 transition-colors"
          >
            Wyloguj
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-6 border-b border-zinc-800 pb-2">
          {(['appointments', 'services', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-semibold pb-1 transition-all ${
                activeTab === tab
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-zinc-500 hover:text-amber-200'
              }`}
            >
              {tab === 'appointments' ? '📅 Rezerwacje' : tab === 'services' ? '✂️ Usługi' : '⚙️ Ustawienia'}
            </button>
          ))}
        </div>

        {/* TAB: Rezerwacje */}
        {activeTab === 'appointments' && (
          <div>
            {loadingData ? (
              <p className="text-amber-200 text-sm animate-pulse">Wczytywanie rezerwacji...</p>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm">Brak aktywnych rezerwacji.</p>
              </div>
            ) : (
              <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl overflow-x-auto">
                <p className="text-xs text-zinc-400 mb-4">Łącznie: <span className="text-amber-400 font-bold">{appointments.length}</span> rezerwacji</p>
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-amber-500/30 text-amber-400 uppercase text-xs">
                      <th className="p-3">Klient</th>
                      <th className="p-3">Usługa</th>
                      <th className="p-3">Termin</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Telefon</th>
                      <th className="p-3 text-center">Akcja</th>
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
                          <button
                            onClick={() => handleDeleteAppointment(item.id)}
                            disabled={deletingId === item.id}
                            className="bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
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

        {/* TAB: Usługi */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            {/* Formularz dodawania */}
            <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-amber-400 mb-4">➕ Dodaj nową usługę</h2>
              <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Nazwa usługi (np. Strzyżenie)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="md:col-span-2 bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                  required
                />
                <input
                  type="number"
                  placeholder="Czas (min)"
                  value={newServiceDuration}
                  onChange={(e) => setNewServiceDuration(e.target.value)}
                  className="bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                  min="15"
                  step="15"
                  required
                />
                <input
                  type="number"
                  placeholder="Cena (PLN)"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="bg-zinc-900 border border-amber-500/30 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                  min="0"
                  step="0.01"
                />
                <button
                  type="submit"
                  disabled={addingService}
                  className="md:col-span-4 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {addingService ? 'Dodawanie...' : 'Dodaj usługę'}
                </button>
              </form>
            </div>

            {/* Lista usług */}
            <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-amber-400 mb-4">📋 Twoje usługi</h2>
              {services.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-6">Brak usług. Dodaj pierwszą usługę powyżej.</p>
              ) : (
                <div className="space-y-2">
                  {services.map((srv) => (
                    <div key={srv.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                      <div>
                        <span className="font-semibold text-amber-200 text-sm">{srv.name}</span>
                        <span className="text-zinc-500 text-xs ml-3">⏱ {srv.duration_minutes} min</span>
                        {srv.price && <span className="text-zinc-400 text-xs ml-3">💰 {srv.price} PLN</span>}
                      </div>
                      <button
                        onClick={() => handleDeleteService(srv.id)}
                        className="text-red-400 hover:text-red-300 text-xs font-bold border border-red-500/30 px-2 py-1 rounded transition-colors"
                      >
                        Usuń
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Ustawienia */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 max-w-xl space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-amber-400">⚙️ Konfiguracja Salonu</h2>

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
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nowe Hasło (zostaw puste jeśli nie zmieniasz)</label>
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
              <p className="text-xs text-zinc-500 mt-1">Zmienne: {'{NAME}'}, {'{SERVICE}'}, {'{DATE}'}, {'{TIME}'}</p>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {savingSettings ? 'Zapisywanie...' : 'Zapisz Ustawienia'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
