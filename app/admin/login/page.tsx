'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = '/admin';
      } else {
        const data = await res.json();
        setError(data.error || 'Nieprawidłowe hasło');
      }
    } catch (err) {
      setError('Wystąpił błąd połączenia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-amber-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(217,119,6,0.15)]">
        <h1 className="text-2xl font-bold text-center text-amber-400 mb-6 tracking-wide">
          Panel Administratora
        </h1>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-amber-200/80 mb-2">
              Hasło dostępu
            </label>
            
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wpisz hasło..."
                required
                className="w-full bg-zinc-900 !bg-zinc-900 border border-amber-500/30 focus:border-amber-400 text-amber-100 placeholder-zinc-500 rounded-lg px-4 py-3 text-sm outline-none transition-all pr-16 focus:ring-1 focus:ring-amber-400"
              />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 rounded transition-colors z-10"
              >
                {showPassword ? 'Ukryj' : 'Pokaż'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg text-red-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold py-3 rounded-lg text-sm transition-all duration-200 shadow-md hover:shadow-amber-500/20 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>
      </div>
    </div>
  );
}