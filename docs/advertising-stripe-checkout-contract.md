# LUMAR — kontrakt implementacji Stripe Checkout

Status: specyfikacja dla gałęzi testowej. Checkout pozostaje wyłączony; dokument nie tworzy płatności ani nie zmienia bazy.

## Stan wyjściowy potwierdzony w kodzie

- Katalog cen jest w `lib/advertising/catalog.ts`; kwoty są cenami netto PLN.
- `POST /api/advertising/quote` zwraca `payable: false` i nie tworzy zamówień.
- `lib/advertising/auth.ts` weryfikuje bearer token przez Supabase Auth i ma sprawdzanie allowlisty administratorów oraz właściciela salonu.
- `package.json` i `package-lock.json` nie zawierają pakietu `stripe`.
- W Supabase nie znaleziono tabel reklamowych; migracja jest jedynie wersjonowanym szkicem i nie została zastosowana.
- Nie znaleziono `STRIPE_WEBHOOK_SECRET` w metadanych środowiska Vercel.

## Kontrakt endpointu tworzenia Checkout

Proponowana ścieżka: `POST /api/advertising/checkout`.

Endpoint ma pozostać zamknięty i zwracać `503` do czasu, gdy wszystkie poniższe warunki są spełnione:
1. Zatwierdzony schemat zamówień istnieje w środowisku testowym.
2. Pakiet, typ klienta i czas emisji są walidowane przez katalog serwerowy; cena i waluta z klienta są ignorowane.
3. Użytkownik jest uwierzytelniony przez Supabase Auth. Dla salonu sprawdzana jest własność salonu po stronie serwera.
4. Weryfikacja danych i uprawnień kończy się przed utworzeniem zamówienia.
5. Zamówienie jest trwale zapisane jako `pending` przed utworzeniem sesji Stripe; operacja ma klucz idempotencji i obsługę awarii częściowej.
6. Stripe Checkout Session tworzona jest na serwerze przy użyciu `STRIPE_SECRET_KEY`, z walutą `pln`, kwotą w groszach wyliczoną z katalogu oraz identyfikatorem zamówienia po stronie serwera.
7. Nie ufamy kwocie, statusowi ani metadanym dostarczonym przez przeglądarkę.
8. Success URL jest wyłącznie informacją dla użytkownika; nie oznacza zapłaty i nie aktywuje kampanii.
9. Nie dodajemy żadnego klucza sekretnego do kodu klienta ani logów.

## Kontrakt webhooka

Proponowana ścieżka: `POST /api/advertising/stripe-webhook`.

- Odczyt surowego body i weryfikacja nagłówka podpisu przez Stripe SDK oraz `STRIPE_WEBHOOK_SECRET`.
- Odrzucenie niepoprawnego podpisu bez zmiany zamówienia.
- Idempotentny zapis identyfikatora zdarzenia w `ad_stripe_webhook_events`; powtórka zdarzenia nie może drugi raz zmienić statusu.
- Przed oznaczeniem zamówienia jako opłaconego należy sprawdzić zdarzenie i sesję po stronie serwera, kwotę, walutę, powiązanie z zamówieniem oraz status płatności.
- Aktualizacja statusu zamówienia i zapis zdarzenia powinny być atomowe, najlepiej przez ograniczoną funkcję bazodanową/transaction boundary; w razie błędu webhook ma umożliwić bezpieczne ponowienie.
- Płatność nie ustawia kampanii jako `active`; kampania trafia do `pending_review` i czeka na moderację.
- Nie wolno ujawniać treści sekretów w logach.

## Wymagania przed implementacją kodu

1. Dodać oficjalny pakiet `stripe` poprzez menedżer pakietów w środowisku repozytorium, a następnie wygenerować prawidłowy `package-lock.json`. Nie edytować lockfile ręcznie.
2. Sprawdzić kompilację i wersję Node/Next oraz wzorce route handlers.
3. Zrecenzować migrację SQL; zastosować ją dopiero po potwierdzeniu mapowania projektu Supabase i wyłącznie na bazie testowej.
4. Skonfigurować testowy endpoint webhook w Stripe i zapisać jego sekret w Vercel Preview. Nie umieszczać testowego sekretu w Production.
5. Dodać testy cen, auth, właściciela salonu, błędnych kwot, błędnego podpisu, powtórzonego zdarzenia, nieopłaconej sesji, anulowania oraz braku aktywacji przed moderacją.

## Bramka wydania

Do czasu spełnienia wszystkich wymagań:
- wycena pozostaje `payable: false`;
- Checkout nie jest dostępny;
- migracja nie jest stosowana do bazy;
- żadne prawdziwe płatności nie są uruchamiane;
- produkcja pozostaje bez zmian.
