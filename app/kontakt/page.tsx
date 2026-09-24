export default function KontaktPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300">
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-8">

        <div>
          <h1 className="text-3xl font-black text-amber-400">Kontakt</h1>
          <p className="text-zinc-500 text-sm mt-1">LUMAR — System rezerwacji dla salonów</p>
        </div>

        <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Operator serwisu</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-zinc-500">Imię i nazwisko:</span> <span className="text-zinc-100 font-semibold">Wojciech Jarosz</span></p>
            <p><span className="text-zinc-500">Forma działalności:</span> <span className="text-zinc-100">Działalność nierejestrowana</span></p>
            <p><span className="text-zinc-500">E-mail:</span> <a href="mailto:wojciechjarosz41@gmail.com" className="text-amber-400 hover:underline font-semibold">wojciechjarosz41@gmail.com</a></p>
            <p><span className="text-zinc-500">Kontakt:</span> <span className="text-zinc-100">Wyłącznie mailowy</span></p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-white">W czym mogę pomóc?</h2>
          <ul className="text-sm space-y-2 text-zinc-400">
            <li>📧 Problemy techniczne z Serwisem</li>
            <li>📧 Pytania dotyczące rejestracji salonu</li>
            <li>📧 Zgłoszenia dotyczące ochrony danych osobowych</li>
            <li>📧 Inne pytania związane z LUMAR</li>
          </ul>
          <p className="text-xs text-zinc-600 pt-2">Staram się odpowiadać na wiadomości w ciągu 1-3 dni roboczych.</p>
        </div>

        <div className="text-center pt-4">
          <a href="/" className="text-xs text-zinc-600 hover:text-amber-400 transition-colors">← Wróć do LUMAR</a>
        </div>
      </div>
    </div>
  );
}
