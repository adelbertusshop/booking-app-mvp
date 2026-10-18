'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const prepare = async () => {
      // Supabase JS reads the recovery tokens from the URL fragment and establishes
      // a temporary session. A recovery link must provide that session before updateUser.
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      if (sessionError || !data.session) {
        setError('Link do zmiany hasła jest nieprawidłowy, wygasł lub został już wykorzystany. Poproś o nowy link.');
      }
      setReady(true);
    };

    void prepare();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setError('');
        setReady(true);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Nowe hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Podane hasła nie są takie same.');
      return;
    }

    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError('Brak aktywnego linku odzyskiwania. Poproś o nową wiadomość.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError('Nie udało się zmienić hasła. Sprawdź wymagania hasła lub poproś o nowy link.');
      setSaving(false);
      return;
    }

    await supabase.auth.signOut();
    setPassword('');
    setConfirmPassword('');
    setMessage('Hasło zostało zmienione. Możesz teraz zalogować się nowym hasłem.');
    setSaving(false);
  };

  return (
    <main className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-zinc-950 border border-amber-500/30 p-8 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
        <p className="text-xs text-amber-400 font-bold tracking-widest text-center">LUMAR</p>
        <h1 className="text-xl font-bold text-amber-400 text-center">Ustaw nowe hasło</h1>
        <p className="text-xs text-zinc-400 text-center">Wpisz nowe hasło do panelu swojego salonu.</p>

        {error && <p role="alert" className="text-red-400 text-xs text-center bg-red-950/40 border border-red-500/30 p-3 rounded-lg">{error}</p>}
        {message && <p role="status" className="text-emerald-400 text-xs text-center bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg">{message}</p>}

        {!message && (
          <>
            <div>
              <label htmlFor="new-password" className="block text-xs font-bold text-amber-300 uppercase mb-1">Nowe hasło</label>
              <input id="new-password" type="password" autoComplete="new-password" value={password}
                onChange={(event) => setPassword(event.target.value)} minLength={8} required
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                placeholder="Co najmniej 8 znaków" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-bold text-amber-300 uppercase mb-1">Powtórz hasło</label>
              <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required
                className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-3 text-amber-100 text-sm focus:outline-none focus:border-amber-400"
                placeholder="Wpisz hasło ponownie" />
            </div>
            <button type="submit" disabled={!ready || saving || Boolean(error)}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-2.5 rounded-lg text-sm transition-colors">
              {saving ? 'Zapisywanie…' : 'Zapisz nowe hasło'}
            </button>
          </>
        )}

        <Link href="/admin" className="block text-xs text-amber-400/80 hover:text-amber-300 text-center pt-1">
          Wróć do logowania
        </Link>
      </form>
    </main>
  );
}
