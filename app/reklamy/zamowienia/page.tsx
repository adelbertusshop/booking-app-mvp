'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Order = {
  id: string;
  packageId: string;
  durationDays: number;
  amountMinor: number;
  currency: string;
  paymentStatus: string;
  paidAt: string | null;
  createdAt: string;
  campaign: {
    title?: string;
    status?: string;
    starts_at?: string | null;
    ends_at?: string | null;
  } | null;
};

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(amountMinor / 100);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Oczekuje na płatność',
    paid: 'Opłacone',
    failed: 'Płatność nieudana',
    cancelled: 'Anulowane',
    refunded: 'Zwrócone',
    disputed: 'Reklamacja płatności',
    pending_review: 'Oczekuje na moderację',
    active: 'Reklama aktywna',
    rejected: 'Reklama odrzucona',
    completed: 'Emisja zakończona',
    paused: 'Wstrzymana',
    scheduled: 'Zaplanowana',
  };
  return labels[status] ?? status;
}

export default function AdvertisingOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Zaloguj się, aby zobaczyć swoje zamówienia reklamowe.');
      const response = await fetch('/api/advertising/orders', {
        headers: { Authorization: 'Bearer ' + session.access_token },
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Nie udało się pobrać zamówień.');
      setOrders(Array.isArray(result.orders) ? result.orders : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas pobierania zamówień.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">LUMAR · Reklamy</p>
            <h1 className="mt-2 text-3xl font-black">Moje zamówienia</h1>
            <p className="mt-2 text-sm text-zinc-400">Historia płatności i status emisji kampanii.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => void loadOrders()} disabled={loading} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:border-zinc-500 disabled:opacity-50">Odśwież</button>
            <Link href="/reklamy" className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950">Nowa reklama</Link>
          </div>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
        {loading ? (
          <p className="py-12 text-center text-zinc-400">Pobieram zamówienia…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-lg font-bold">Nie masz jeszcze zamówień reklamowych.</p>
            <Link href="/reklamy" className="mt-4 inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950">Przejdź do oferty</Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold">{order.campaign?.title || order.packageId}</h2>
                    <p className="mt-1 text-xs text-zinc-500">Zamówienie {order.id} · {order.durationDays} dni · {new Date(order.createdAt).toLocaleString('pl-PL')}</p>
                  </div>
                  <p className="text-xl font-black text-amber-300">{money(order.amountMinor, order.currency)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs">{statusLabel(order.paymentStatus)}</span>
                  {order.campaign?.status && <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs">{statusLabel(order.campaign.status)}</span>}
                </div>
                {order.paidAt && <p className="mt-3 text-xs text-zinc-400">Opłacono: {new Date(order.paidAt).toLocaleString('pl-PL')}</p>}
                {order.campaign?.starts_at && <p className="mt-1 text-xs text-zinc-400">Start emisji: {new Date(order.campaign.starts_at).toLocaleString('pl-PL')}</p>}
                {order.campaign?.ends_at && <p className="mt-1 text-xs text-zinc-400">Koniec emisji: {new Date(order.campaign.ends_at).toLocaleString('pl-PL')}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
