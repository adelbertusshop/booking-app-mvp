'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return 'Hasło musi mieć co najmniej 12 znaków.';
  if (!/[a-z]/.test(password)) return 'Hasło musi zawierać małą literę.';
  if (!/[A-Z]/.test(password)) return 'Hasło musi zawierać wielką literę.';
  if (!/[0-9]/.test(password)) return 'Hasło musi zawierać cyfrę.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Hasło musi zawierać znak specjalny.';
  return null;
}

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setReady(Boolean(session));
      if (session) setMessage('');
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      setReady(Boolean(session));
      if (!session) {
        setMessage(error
          ? 'Nie udało się sprawdzić linku. Odśwież stronę lub poproś o nowy link.'
          : 'Link jest nieprawidłowy lub wygasł. Poproś o nowy link na ekranie logowania.');
      }
    }).catch(() => {
      if (active) {
        setReady(false);
        setMessage('Nie udało się sprawdzić linku. Odśwież stronę lub poproś o nowy link.');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    const policyError = passwordPolicyError(password);
    if (policyError) { setMessage(policyError); return; }
    if (password !== confirmation) { setMessage('Podane hasła nie są identyczne.'); return; }
    if (!ready) { setMessage('Link jest nieprawidłowy lub wygasł. Poproś o nowy link.'); return; }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage('Nie udało się zmienić hasła. Link mógł wygasnąć — poproś o nowy.');
      } else {
        setSuccess(true);
        setMessage('Hasło zostało zmienione. Możesz przejść do panelu LUMAR.');
        setPassword('');
        setConfirmation('');
      }
    } catch {
      setMessage('Nie udało się zmienić hasła z powodu błędu połączenia. Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
      <section className="bg-zinc-950 border border-amber-500/30 p-8 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
        <h1 className="text-xl font-bold text-amber-400 text-center">Ustaw nowe hasło</h1>
        <p className="text-sm text-zinc-400 text-center">LUMAR — odzyskiwanie dostępu do panelu salonu.</p>
        {message && <p role="status" className={`text-xs text-center p-3 rounded-lg border ${success ? 'text-emerald-300 bg-emerald-950/30 border-emerald-500/30' : 'text-amber-200 bg-amber-950/30 border-amber-500/30'}`}>{message}</p>}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Nowe hasło</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password" minLength={12} required disabled={!ready || saving}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-1">Powtórz nowe hasło</label>
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password" minLength={12} required disabled={!ready || saving}
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400 disabled:opacity-50" />
            </div>
            <p className="text-xs text-zinc-500">Minimum 12 znaków, mała i wielka litera, cyfra oraz znak specjalny.</p>
            <button type="submit" disabled={!ready || saving}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {saving ? 'Zapisywanie…' : 'Zapisz nowe hasło'}
            </button>
          </form>
        )}
        <p className="text-center text-xs text-zinc-400"><Link href="/admin" className="text-amber-400 hover:text-amber-300">Wróć do logowania</Link></p>
      </section>
    </main>
  );
}
