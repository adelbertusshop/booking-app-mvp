export default function PolitykaPrywatnosci() {
  return (
    <div className="min-h-screen bg-black text-zinc-300">
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-8">

        <div className="border border-amber-500/30 bg-amber-950/20 rounded-xl px-5 py-3">
          <p className="text-xs text-amber-400 font-bold">⚠️ WERSJA ROBOCZA — do weryfikacji przed publicznym uruchomieniem</p>
        </div>

        <div>
          <h1 className="text-3xl font-black text-amber-400">Polityka prywatności LUMAR</h1>
          <p className="text-xs text-zinc-500 mt-1">Ostatnia aktualizacja: wersja robocza 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">1. Administrator danych</h2>
          <p className="text-sm leading-relaxed">Administratorem danych osobowych właścicieli salonów zarejestrowanych w Serwisie LUMAR jest Wojciech Jarosz, prowadzący działalność nierejestrowaną, kontakt: wojciechjarosz41@gmail.com.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. Dane właścicieli salonów</h2>
          <p className="text-sm leading-relaxed">W ramach rejestracji i korzystania z panelu LUMAR przetwarzamy następujące dane właściciela salonu:</p>
          <ul className="text-sm space-y-1 ml-4 list-disc list-inside text-zinc-400">
            <li>adres e-mail (konto i powiadomienia),</li>
            <li>nazwa salonu,</li>
            <li>dane konfiguracyjne salonu (godziny pracy, usługi, ceny).</li>
          </ul>
          <p className="text-sm leading-relaxed mt-2"><strong className="text-zinc-100">Cel:</strong> świadczenie usługi LUMAR — umożliwienie zarządzania rezerwacjami online.</p>
          <p className="text-sm leading-relaxed"><strong className="text-zinc-100">Podstawa prawna:</strong> art. 6 ust. 1 lit. b RODO — wykonanie umowy o świadczenie usługi.</p>
          <p className="text-sm leading-relaxed"><strong className="text-zinc-100">Okres przechowywania:</strong> przez czas korzystania z Serwisu i przez okres wymagany przepisami prawa po jego zakończeniu.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Dane klientów salonów</h2>
          <p className="text-sm leading-relaxed">Klienci salonów podają przy dokonywaniu rezerwacji: imię i nazwisko, adres e-mail, numer telefonu.</p>
          <p className="text-sm leading-relaxed"><strong className="text-zinc-100">Administratorem</strong> tych danych jest właściciel salonu, który korzysta z LUMAR jako narzędzia technicznego do ich zbierania i przechowywania.</p>
          <p className="text-sm leading-relaxed"><strong className="text-zinc-100">LUMAR pełni rolę podmiotu przetwarzającego</strong> (procesora) w rozumieniu art. 28 RODO — przetwarza dane klientów salonów wyłącznie w imieniu i na polecenie właściciela salonu.</p>
          <p className="text-sm leading-relaxed">Dane klientów są przechowywane w bazie danych Supabase (region: EU) i nie są wykorzystywane przez operatora LUMAR do własnych celów marketingowych ani innych celów niezwiązanych ze świadczeniem usługi technicznej.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Usługi zewnętrzne</h2>
          <p className="text-sm leading-relaxed">W celu świadczenia Serwisu korzystamy z następujących usług zewnętrznych:</p>
          <div className="space-y-3">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm space-y-1">
              <p className="font-bold text-zinc-100">Supabase</p>
              <p className="text-zinc-400">Baza danych i uwierzytelnianie. Dane przechowywane na serwerach w regionie EU (Frankfurt). <a href="https://supabase.com/privacy" className="text-amber-400 hover:underline" target="_blank" rel="noopener noreferrer">Polityka prywatności Supabase</a></p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm space-y-1">
              <p className="font-bold text-zinc-100">Vercel</p>
              <p className="text-zinc-400">Hosting aplikacji. Może przetwarzać anonimowe dane techniczne (logi). <a href="https://vercel.com/legal/privacy-policy" className="text-amber-400 hover:underline" target="_blank" rel="noopener noreferrer">Polityka prywatności Vercel</a></p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm space-y-1">
              <p className="font-bold text-zinc-100">Resend</p>
              <p className="text-zinc-400">Wysyłka e-maili potwierdzających rezerwację. Do Resend przekazywane są: imię klienta, adres e-mail, szczegóły rezerwacji. <a href="https://resend.com/legal/privacy-policy" className="text-amber-400 hover:underline" target="_blank" rel="noopener noreferrer">Polityka prywatności Resend</a></p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Prawa użytkowników</h2>
          <p className="text-sm leading-relaxed">Każda osoba, której dane dotyczą, ma prawo do:</p>
          <ul className="text-sm space-y-1 ml-4 list-disc list-inside text-zinc-400">
            <li>dostępu do swoich danych,</li>
            <li>sprostowania danych,</li>
            <li>usunięcia danych („prawo do bycia zapomnianym"),</li>
            <li>ograniczenia przetwarzania,</li>
            <li>przenoszenia danych,</li>
            <li>wniesienia sprzeciwu wobec przetwarzania,</li>
            <li>wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (uodo.gov.pl).</li>
          </ul>
          <p className="text-sm leading-relaxed mt-2">W celu realizacji powyższych praw prosimy o kontakt: wojciechjarosz41@gmail.com</p>
          <p className="text-sm leading-relaxed text-zinc-500">Uwaga: w sprawach danych klientów salonów, które są przetwarzane przez LUMAR jako procesor, właściwy podmiot do kontaktu to właściciel konkretnego salonu jako administrator tych danych.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">6. Pliki cookie</h2>
          <p className="text-sm leading-relaxed">Serwis może korzystać z plików cookie niezbędnych do jego działania (sesja logowania). Nie wykorzystujemy plików cookie do celów marketingowych ani śledzenia.</p>
        </section>

        <div className="border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          <p>Kontakt w sprawach prywatności: wojciechjarosz41@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
