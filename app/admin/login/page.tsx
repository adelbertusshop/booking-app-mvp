'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Błędne hasło');
      }
    } catch {
      setError('Wystąpił błąd połączenia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen text-white bg-slate-950 p-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm p-6 space-y-4 rounded-xl border bg-slate-900 border-slate-800">
        <h1 className="text-xl font-bold text-center">Panel Administratora</h1>
        
        {error && (
          <div className="p-3 text-sm text-red-400 rounded bg-red-950/50 border border-red-500/30">
            {error}
          </div>
        )}

        <div>
          <label className="block mb-1 text-sm text-slate-400">Hasło dostępu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 text-white rounded border bg-slate-800 border-slate-700 focus:outline-none focus:border-cyan-500"
            placeholder="Wpisz hasło..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full p-2 font-medium transition-colors rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
        >
          {loading ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>
    </div>
  );
}