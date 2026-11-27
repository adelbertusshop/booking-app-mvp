'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Campaign = {
  id: string;
  package_id: string;
  client_type: string;
  placement: string;
  placement_slot: string;
  title: string;
  body: string | null;
  destination_url: string;
  image_path: string | null;
  duration_days: number;
  created_at: string;
};

function creativeUrl(path: string | null) {
  return path ? supabase.storage.from('lumar-advertising').getPublicUrl(path).data.publicUrl : null;
}

function destinationWarning(value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.toLowerCase().split('/').filter(Boolean);
    if (url.protocol !== 'https:' || url.username || url.password) return 'UWAGA: adres nie spełnia wymogów HTTPS.';
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1' || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.')) return 'UWAGA: adres lokalny lub prywatny.';
    if (segments.some((segment) => ['api', 'admin', 'webhook', 'checkout', 'login', 'reklamy'].includes(segment))) return 'UWAGA: adres wygląda na panel, API lub techniczny proces, a nie stronę reklamową.';
    return null;
  } catch { return 'UWAGA: nieprawidłowy adres URL.'; }
}

function clientTypeLabel(value: string) {
  return value === 'salon_w_aplikacji' ? 'Salon w LUMAR' : value === 'firma_zewnetrzna' ? 'Firma zewnętrzna' : value;
}

export default function AdvertisingModerationPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setCampaigns([]);
        setError('Zaloguj się na konto administratora LUMAR.');
        return;
      }
      const response = await fetch('/api/advertising/moderation', {
        headers: { Authorization: 'Bearer ' + session.access_token },
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Nie udało się pobrać kampanii.');
      setCampaigns(Array.isArray(result.campaigns) ? result.campaigns : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas pobierania kampanii.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  async function decide(campaignId: string, decision: 'approve' | 'reject') {
    setBusyId(campaignId);
    setError('');
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sesja wygasła. Zaloguj się ponownie.');
      const response = await fetch('/api/advertising/moderation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          campaignId,
          decision,
          note: note[campaignId] ?? '',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Nie udało się zapisać decyzji.');
      setMessage(decision === 'approve' ? 'Kampania została zatwierdzona i uruchomiona.' : 'Kampania została odrzucona.');
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd moderacji.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">LUMAR · panel platformy</p>
            <h1 className="mt-2 text-3xl font-black">Moderacja reklam</h1>
            <p className="mt-2 text-sm text-zinc-400">Płatna kampania nie trafia do emisji bez zatwierdzenia.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => void loadCampaigns()} disabled={loading} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:border-zinc-500 disabled:opacity-50">Odśwież</button>
            <Link href="/admin" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:border-zinc-500">Panel salonu</Link>
          </div>
        </header>

        {message && <p role="status" className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</p>}
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

        {loading ? (
          <p className="py-12 text-center text-zinc-400">Pobieram kampanie…</p>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-lg font-bold">Brak kampanii oczekujących na moderację.</p>
            <p className="mt-2 text-sm text-zinc-400">Nowe opłacone zamówienia pojawią się tutaj po potwierdzeniu webhooka Stripe.</p>
          </div>
        ) : (
          <div className="grid gap-5">
            {campaigns.map((campaign) => {
              const imageUrl = creativeUrl(campaign.image_path);
              return (
                <article key={campaign.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{campaign.title}</h2>
                      <p className="mt-1 text-xs text-zinc-500">{campaign.package_id} · {clientTypeLabel(campaign.client_type)} · {campaign.duration_days} dni</p>
                    </div>
                    <span className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-200">OCZEKUJE NA MODERACJĘ</span>
                  </div>

                  <section className="mt-5 grid gap-4 rounded-xl border border-zinc-700 bg-zinc-950/70 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Miejsce emisji</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-100">{campaign.placement_slot}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Rodzaj reklamodawcy</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-100">{clientTypeLabel(campaign.client_type)}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Adres docelowy reklamy — pełny adres</p>
                      <a
                        href={campaign.destination_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block break-all rounded-lg border border-amber-400/30 bg-zinc-900 p-3 text-sm text-amber-200 underline decoration-amber-400/50 underline-offset-4 hover:text-amber-100"
                      >
                        {campaign.destination_url}
                      </a>
                      <p className="mt-2 text-xs text-zinc-500">Sprawdź, czy adres prowadzi dokładnie do reklamowanej firmy lub salonu.</p>{destinationWarning(campaign.destination_url) && <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm font-bold text-red-200">{destinationWarning(campaign.destination_url)} Zatwierdzenie będzie blokowane po stronie serwera.</p>}
                    </div>
                  </section>

                  <section className="mt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Grafika reklamowa</p>
                    {imageUrl ? (
                      <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="inline-block max-w-full rounded-xl border border-zinc-700 bg-black p-2">
                        <img src={imageUrl} alt={'Grafika reklamy: ' + campaign.title} className="max-h-72 max-w-full rounded-lg object-contain" />
                        <span className="mt-2 block text-xs text-amber-200 underline">Otwórz grafikę w pełnym rozmiarze</span>
                      </a>
                    ) : (
                      <p className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">Nie dołączono grafiki do tej kampanii.</p>
                    )}
                  </section>

                  {campaign.body && (
                    <section className="mt-5 rounded-xl border border-zinc-700 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Opis reklamy</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{campaign.body}</p>
                    </section>
                  )}

                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500">
                    <span>Zgłoszono: {new Date(campaign.created_at).toLocaleString('pl-PL')}</span>
                    <span>ID kampanii: {campaign.id}</span>
                  </div>

                  <label className="mt-5 block text-sm font-semibold text-zinc-200">
                    Notatka moderatora (opcjonalnie)
                    <textarea
                      value={note[campaign.id] ?? ''}
                      onChange={(event) => setNote((current) => ({ ...current, [campaign.id]: event.target.value }))}
                      maxLength={1000}
                      rows={2}
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-normal text-white outline-none focus:border-amber-400"
                      placeholder="Powód odrzucenia lub uwagi do materiału…"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => void decide(campaign.id, 'approve')} disabled={busyId !== null} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-50">{busyId === campaign.id ? 'Zapisuję…' : 'Zatwierdź i rozpocznij emisję'}</button>
                    <button onClick={() => void decide(campaign.id, 'reject')} disabled={busyId !== null} className="rounded-xl border border-red-500/50 px-5 py-3 text-sm font-bold text-red-200 hover:bg-red-500/10 disabled:opacity-50">Odrzuć kampanię</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
