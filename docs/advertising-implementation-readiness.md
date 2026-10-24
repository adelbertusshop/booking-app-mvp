# LUMAR — lista gotowości do implementacji Checkout

To jest robocza lista kontrolna dla gałęzi `feature/lumar-advertising-plan`. Nie zmienia konfiguracji ani danych.

## Co potwierdzono
- Katalog cen jest w `lib/advertising/catalog.ts`.
- Wycena `POST /api/advertising/quote` jest tylko informacyjna i zwraca `payable: false`.
- `lib/advertising/auth.ts` weryfikuje bearer token przez Supabase Auth.
- Istnieje `package.json` i lockfile npm v3 (`package-lock.json`).
- W gałęzi jest projekt migracji `supabase/migrations/20261022160000_lumar_advertising.sql`; nie został zastosowany.
- Vercel Preview budował wcześniejsze commity gałęzi jako READY.
- Nie ma potwierdzonego testowego `STRIPE_WEBHOOK_SECRET`.

## Zanim powstanie endpoint Checkout
- Dodać oficjalny pakiet `stripe` przez npm w środowisku repozytorium, generując prawdziwy lockfile.
- Uruchomić `npm ci`, lint i build.
- Sprawdzić kompatybilność wersji Node z projektem.
- Nie tworzyć Checkout, dopóki trwałe zapisywanie zamówień w bazie testowej nie jest gotowe.
- W przypadku brakujących tabel, konfiguracji lub kluczy zwracać bezpieczny błąd `503`; nie udawać płatności.

## Wymagane testy przed włączeniem Checkout
- błędny JSON, za duże body, nieznany pakiet, niedozwolony czas;
- próba przesłania własnej ceny lub waluty;
- brak tokenu, nieważny token, cudzy salon;
- brak sekretu Stripe i brak konfiguracji bazy;
- błędny podpis webhooka;
- powtórzone zdarzenie Stripe;
- płatność nieudana/anulowana;
- prawidłowa płatność testowa;
- płatność bez automatycznej aktywacji reklamy;
- brak ujawniania sekretów w odpowiedziach i logach.

## Uwaga na ograniczenia środowiska pracy
Jeśli nie ma dostępu do roboczego checkoutu repozytorium i narzędzia npm, nie wolno ręcznie zgadywać wpisów `package-lock.json`. W takiej sytuacji należy najpierw przygotować zmianę w środowisku, które uruchomi npm i testy, albo poprosić właściciela o wykonanie kontrolowanego kroku. Sam commit przez GitHub Contents API nie zastępuje testów instalacji i kompilacji.

## Bramka produkcyjna
Nie stosować migracji w bazie produkcyjnej, nie włączać płatności live, nie łączyć zmian z główną gałęzią i nie aktywować reklam bez osobnej akceptacji właściciela.
