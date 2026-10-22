# LUMAR — uzgodnienie schematu reklam z Supabase

Status: audyt odczytowy i plan migracji. Ten dokument nie wykonuje zmian w bazie.

## Potwierdzona baza projektu

Projekt Supabase `wojciech Wojownik` jest projektem LUMAR. Odczytany identyfikator projektu: `cnfrbelkckbtkzhwyxqm`. Status zgłoszony przez Supabase: `ACTIVE_HEALTHY`.

W publicznym schemacie istnieją tabele:
- `providers`
- `provider_availability`
- `appointments`
- `services`
- `bookings`
- `admin_settings`
- `salons`
- `salon_hours`

Historia projektu zawiera 10 migracji, w tym migracje zabezpieczające RLS, ograniczające odczyty publiczne oraz chroniące przed nakładaniem się aktywnych rezerwacji.

W sprawdzonym schemacie nie znaleziono tabel reklamowych:
- `ad_campaigns`
- `ad_orders`
- `ad_events`
- `ad_stripe_webhook_events`

Nie zastosowano żadnej migracji i nie zmieniono danych.

## Ostrzeżenia z audytu Supabase

1. Advisor zgłosił tabele `admin_settings`, `bookings` i `providers` z włączonym RLS, ale bez polityk. Nie zmieniać ich automatycznie w ramach prac reklamowych — najpierw trzeba przeanalizować zależności i wpływ na działające funkcje.
2. Advisor zgłosił wyłączoną ochronę przed hasłami ujawnionymi w wyciekach. To osobny temat konfiguracji Auth, wymagający świadomej decyzji i sprawdzenia wpływu na rejestrację/logowanie.
3. Potwierdzono, że `salons.user_id` wskazuje `auth.users(id)`. Funkcje reklamowe muszą weryfikować właściciela salonu po stronie serwera.

## Blokada przed wykonaniem migracji

Projekt Supabase jest potwierdzony jako LUMAR, ale przed zastosowaniem zmian trzeba jeszcze potwierdzić, czy ten sam projekt obsługuje Vercel Preview, Production, czy oba środowiska. Nie wolno wyciągać tego wniosku wyłącznie z nazwy projektu ani z obecności zmiennych środowiskowych.

Do czasu potwierdzenia mapowania środowisk:
- nie uruchamiać SQL w Supabase;
- nie stosować `docs/advertising-schema-proposal.sql` jako gotowej migracji;
- nie włączać płatności ani nie tworzyć sesji Checkout;
- pozostawić endpoint wyceny w trybie `payable: false`.

## Warunki bezpiecznej migracji reklamowej

Przed utworzeniem i zastosowaniem wersjonowanej migracji należy przejrzeć projekt migracji oraz potwierdzić:

- spójność z istniejącymi typami ID i relacjami do `salons` oraz `auth.users`;
- jednoznaczne rozdzielenie zamówienia, kampanii, płatności i moderacji;
- kwoty przechowywane jako całkowite grosze oraz snapshot pakietu/ceny przy zamówieniu;
- zakaz bezpośredniego zapisu przez role `anon` i `authenticated` bez jawnie zatwierdzonych polityk;
- brak możliwości aktywacji kampanii przez przekierowanie przeglądarki lub dane od klienta;
- idempotencję webhooków Stripe, kontrolę podpisu i bezpieczne ponawianie obsługi zdarzeń;
- ograniczenia i walidację treści reklamy oraz adresów docelowych;
- indeksy pod odczyt aktywnych kampanii i historię zamówień;
- aktualizację statusu kampanii dopiero po potwierdzeniu płatności i osobnej akceptacji moderacyjnej.

## Kolejność dalszych prac na gałęzi testowej

1. Potwierdzić mapowanie Vercel Preview/Production do projektu Supabase bez ujawniania sekretów.
2. Przejrzeć istniejący schemat, migracje oraz aktualny plik propozycji SQL.
3. Przygotować nową wersjonowaną migrację wyłącznie na gałęzi `feature/lumar-advertising-plan`; nie uruchamiać jej automatycznie.
4. Dodać Stripe SDK przez właściwy menedżer pakietów i zaktualizować lockfile przez narzędzie pakietów, nie ręcznie.
5. Dodać serwerowy Checkout oraz webhook w trybie testowym dopiero po uzgodnieniu schematu i konfiguracji.
6. Wykonać testy negatywne i pozytywne na Preview. Bez płatności live.
7. Osobna akceptacja właściciela jest wymagana przed wdrożeniem na produkcję.

## Konfiguracja Stripe — znane ograniczenia

Według odczytu metadanych Vercel zmienne `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i `STRIPE_SECRET_KEY` były przypisane do Production, Preview i Development. Właściciel informuje, że są to klucze testowe. Nie odczytywano ich wartości. W metadanych nie znaleziono `STRIPE_WEBHOOK_SECRET`.

Przed jakimkolwiek wydaniem należy odseparować klucze testowe od Production. Sekret podpisu webhooka należy dodać dopiero po utworzeniu testowego endpointu webhook i tylko do potrzebnych środowisk. Nie umieszczać wartości sekretów w dokumentacji, commitach ani rozmowie.

## Stan końcowy audytu

- Baza LUMAR: potwierdzona.
- Tabele reklamowe: nie istnieją w sprawdzonym schemacie.
- Migracja reklamowa: nieuruchomiona.
- Stripe Checkout i webhook: niezaimplementowane.
- Pobieranie płatności: wyłączone.
- Produkcja: bez zmian.
