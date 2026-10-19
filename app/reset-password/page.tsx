'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  {
    auth: {
      flowType: 'pkce',
      // The page exchanges recovery codes itself so React Strict Mode cannot
      // race the SDK's automatic URL detection against our recovery handling.
      detectSessionInUrl: false,
    },
  }
);

function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return 'Hasło musi mieć co najmniej 12 znaków.';
  if (!/[a-z]/.test(password)) return 'Hasło musi zawierać małą literę.';
  if (!/[A-Z]/.test(password)) return 'Hasło musi zawierać wielką literę.';
  if (!/[0-9]/.test(password)) return 'Hasło musi zawierać cyfrę.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Hasło musi zawierać znak specjalny.';
  return null;
}

type RecoveryResult = { ready: boolean; message: string };

// Reuse an in-flight exchange if React Strict Mode runs the effect twice.
const recoveryExchanges = new Map<string, Promise<RecoveryResult>>();

function establishRecoverySession(): Promise<RecoveryResult> {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('code');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const recoveryType = url.searchParams.get('type') || hashParams.get('type');
  const urlError = url.searchParams.get('error_description') || hashParams.get('error_description');

  if (urlError) {
    return Promise.resolve({
      ready: false,
      message: 'Link jest nieprawidłowy lub wygasł. Poproś o nowy link na ekranie logowania.',
    });
  }

  if (code) {
    const existing = recoveryExchanges.get(code);
    if (existing) return existing;

    // Remove the one-time code from the address bar while retaining it in memory.
    url.searchParams.delete('code');
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);

    const exchange = supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (error || !data.session) {
        return {
          ready: false,
          message: 'Nie udało się potwierdzić linku. Poproś o nowy link do odzyskiwania hasła.',
        };
      }
      return { ready: true, message: '' };
    }).catch(() => ({
      ready: false,
      message: 'Nie udało się potwierdzić linku. Sprawdź połączenie lub poproś o nowy link.',
    }));

    recoveryExchanges.set(code, exchange);
    return exchange;
  }

  // Support older implicit-flow recovery links only when explicitly marked as recovery.
  if (accessToken && refreshToken && recoveryType === 'recovery') {
    window.history.replaceState({}, document.title, url.pathname + url.search);
    return supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }).then(({ data, error }) => {
      if (error || !data.session) {
        return {
          ready: false,
          message: 'Nie udało się potwierdzić linku. Poproś o nowy link do odzyskiwania hasła.',
        };
      }
      return { ready: true, message: '' };
    }).catch(() => ({
      ready: false,
      message: 'Nie udało się potwierdzić linku. Sprawdź połączenie lub poproś o nowy link.',
    }));
  }

  return Promise.resolve({
    ready: false,
    message: 'Link jest nieprawidłowy lub wygasł. Poproś o nowy link na ekranie logowania.',
  });
}

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Sprawdzanie linku do odzyskiwania hasła…');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    establishRecoverySession().then((result) => {
      if (!active) return;
      setReady(result.ready);
      setMessage(result.message);
    }).catch(() => {
      if (!active) return;
      setReady(false);
      setMessage('Nie udało się sprawdzić linku. Poproś o nowy link do odzyskiwania hasła.');
    });

    return () => {
      active = false;
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
        setReady(false);
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
