export default function RegulamiPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300">
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-8">

        <div className="border border-amber-500/30 bg-amber-950/20 rounded-xl px-5 py-3">
          <p className="text-xs text-amber-400 font-bold">⚠️ WERSJA ROBOCZA — do weryfikacji przed publicznym uruchomieniem</p>
        </div>

        <div>
          <h1 className="text-3xl font-black text-amber-400">Regulamin LUMAR</h1>
          <p className="text-xs text-zinc-500 mt-1">Ostatnia aktualizacja: wersja robocza 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">§1. Postanowienia ogólne</h2>
          <p className="text-sm leading-relaxed">1. LUMAR (dalej: „Serwis") to system rezerwacji wizyt online dla salonów kosmetycznych i usługowych, dostępny pod adresem booking-app-mvp.vercel.app.</p>
          <p className="text-sm leading-relaxed">2. Operatorem Serwisu jest Wojciech Jarosz, prowadzący działalność nierejestrowaną, kontakt: wojciechjarosz41@gmail.com.</p>
          <p className="text-sm leading-relaxed">3. Korzystanie z Serwisu oznacza akceptację niniejszego Regulaminu.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">§2. Rodzaje użytkowników</h2>
          <p className="text-sm leading-relaxed">1. <strong className="text-zinc-100">Właściciel salonu</strong> — osoba rejestrująca salon w Serwisie i zarządzająca rezerwacjami przez panel administracyjny.</p>
          <p className="text-sm leading-relaxed">2. <strong className="text-zinc-100">Klient salonu</strong> — osoba dokonująca rezerwacji wizyty przez Serwis.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">§3. Plan FREE</h2>
          <p className="text-sm leading-relaxed">1. Rejestracja w Serwisie i korzystanie z podstawowych funkcji jest bezpłatne (plan FREE).</p>
          <p className="text-sm leading-relaxed">2. Plan FREE obejmuje:</p>
          <ul className="text-sm space-y-1 ml-4 list-disc list-inside text-zinc-400">
            <li>maksymalnie 10 usług w ofercie salonu,</li>
            <li>maksymalnie 50 rezerwacji w miesiącu kalendarzowym,</li>
            <li>własny link do rezerwacji dla klientów,</li>
            <li>panel zarządzania rezerwacjami,</li>
            <li>powiadomienia e-mail przy nowej rezerwacji i odwołaniu.</li>
          </ul>
          <p className="text-sm leading-relaxed">3. Operator zastrzega sobie prawo do zmiany limitów planu FREE z zachowaniem odpowiedniego okresu powiadomienia.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">§4. Obowiązki właściciela salonu</h2>
          <p className="text-sm leading-relaxed">1. Właściciel salonu zobowiązuje się do podania prawdziwych danych przy rejestracji.</p>
          <p className="text-sm leading-relaxed">2. Właściciel salonu jest odpowiedzialny za treść oferty (nazwy usług, ceny, godziny pracy) i jej zgodność z rzeczywistością.</p>
          <p className="text-sm leading-relaxed">3. Właściciel salonu jest administratorem danych osobowych swoich klientów w rozumieniu RODO i ponosi odpowiedzialność za ich prawidłowe przetwarzanie.</p>
          <p className="text-sm leading-relaxed">4. Zabronione jest korzystanie z Serwisu w celach niezgodnych z prawem.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">§5. Rezerwacje</h2>
          <p className="text-sm leading-relaxed">1. LUMAR jest narzędziem technicznym umożliwiającym dokonanie rezerwacji. Umowa o świadczenie usługi zawierana jest między klientem a właścicielem salonu — nie z operatorem LUMAR.</p>
          <p className="text-sm leading-relaxed">2. Operator LUMAR nie ponosi odpowiedzialności za niewykonanie lub nienależyte wykonanie usługi przez salon.</p>
          <p className="text-sm leading-relaxed">3. Klient dokonując rezerwacji podaje dane niezbędne do jej realizacji (imię, e-mail, telefon).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">§6. Odpowiedzialność operatora</h2>
          <p className="text-sm leading-relaxed">1. Operator dołoży starań, aby Serwis działał nieprzerwanie, jednak nie gwarantuje jego dostępności przez 100% czasu.</p>
          <p className="text-sm leading-relaxed">2. Operator nie ponosi odpowiedzialności za szkody wynikłe z niedostępności Serwisu, błędów technicznych ani działania sił wyższych.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">§7. Postanowienia końcowe</h2>
          <p className="text-sm leading-relaxed">1. Operator zastrzega sobie prawo do zmiany Regulaminu. O istotnych zmianach właściciele salonów zostaną powiadomieni drogą e-mail.</p>
          <p className="text-sm leading-relaxed">2. W sprawach nieuregulowanych zastosowanie mają przepisy prawa polskiego.</p>
          <p className="text-sm leading-relaxed">3. Wszelkie spory będą rozpatrywane przez sąd właściwy dla siedziby operatora.</p>
        </section>

        <div className="border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          <p>Kontakt: wojciechjarosz41@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
