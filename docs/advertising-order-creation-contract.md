# LUMAR — kontrakt bezpiecznego tworzenia zamówienia reklamowego

Status: projekt techniczny dla gałęzi testowej. To nie jest aktywny endpoint i nie tworzy zamówień ani płatności.

## Cel

Zdefiniować bezpieczny etap pomiędzy wyceną reklamy a Stripe Checkout. Cena, waluta, tożsamość klienta i status zamówienia muszą być ustalane po stronie serwera.

## Proponowana ścieżka

`POST /api/advertising/orders`

Endpoint wolno wdrożyć dopiero po potwierdzeniu schematu w izolowanej bazie testowej. Do tego czasu nie dodawać aktywnego zapisu do Supabase.

## Żądanie klienta

Dozwolone pola:
- `packageId` — identyfikator z `ADVERTISING_PACKAGES`;
- `clientType` — `salon_w_aplikacji` albo `firma_zewnetrzna`;
- `durationDays` — dokładnie 7, 30 albo 90;
- `salonId` — wymagane dla typu `salon_w_aplikacji`, UUID salonu, który ma być reklamowany;
- opcjonalne pola treści kampanii dopiero po zdefiniowaniu walidacji i limitów.

Nie wolno przyjmować od klienta jako autorytatywnych: kwoty, waluty, podatku, statusu płatności, statusu kampanii, identyfikatora użytkownika właściciela, Stripe Checkout Session ID ani dat zatwierdzenia/aktywacji.

## Wymagana kolejność po stronie serwera

1. Ograniczyć rozmiar body i odrzucić niepoprawny JSON.
2. Wymagać tokenu Bearer Supabase Auth i zweryfikować go przez `authenticateAdvertisingRequest`.
3. Walidować dozwolone pola, identyfikator pakietu, typ klienta i okres emisji. Odrzucać nieznane pola w kontrakcie finalnym, jeśli kompatybilność klienta na to pozwala.
4. Dla `salon_w_aplikacji` wymagać `salonId` i wywołać `verifyAdvertisingSalonOwnership`. Błąd bazy lub brak własności kończy żądanie bez zapisu.
5. Wyliczyć kwotę wyłącznie przez `getAdvertisingNetPrice(packageId, clientType, durationDays)`. Katalog jest źródłem kwoty do zapłaty; waluta `PLN`; kwota w groszach to cena z katalogu pomnożona przez 100. Nie doliczać dodatkowej opłaty podatkowej.
6. Utworzyć rekord zamówienia w stanie `pending` z serwerowym snapshotem pakietu, czasu emisji, typu klienta i kwoty. Nie tworzyć go, jeśli schemat/migracje nie zostały potwierdzone w środowisku testowym.
7. Zabezpieczyć powtórne żądania idempotency key. Klucz musi być powiązany z uwierzytelnionym użytkownikiem i skrótem znormalizowanego żądania; nie wolno dopuścić, by ten sam klucz z innymi danymi podmienił istniejące zamówienie.
8. Zwrócić tylko publiczne pola zamówienia. Nie zwracać sekretów, kluczy serwisowych ani danych wewnętrznych.

## Odpowiedzi i błędy

- `400`: nieprawidłowe dane wejściowe;
- `401`: brak lub nieważna sesja;
- `403`: użytkownik nie jest właścicielem wskazanego salonu;
- `409`: klucz idempotencji został ponownie użyty z innymi danymi;
- `413`: body przekracza limit;
- `503`: konfiguracja/schemat niedostępne albo brak potwierdzenia gotowości usługi.

Nie ujawniać surowych błędów Supabase ani szczegółów konfiguracji.

## Granica z Checkout

Utworzenie zamówienia nie oznacza płatności. Nie może ustawić kampanii jako `active`. Sesja Stripe powinna być osobnym kolejnym krokiem, dopiero po potwierdzeniu zamówienia `pending`, poprawnej konfiguracji Stripe i testowego schematu. Przeglądarkowy success URL nie jest dowodem zapłaty.

Webhook musi osobno weryfikować podpis Stripe na surowym body, środowisko test/live, identyfikator sesji, powiązanie z zamówieniem, kwotę, walutę i status zapłaty. Przejście do `paid` oraz `pending_review` powinno być atomowe i idempotentne.

## Wymagane testy przed uznaniem endpointu za gotowy

1. Brak tokenu, nieważny token i wygaśnięta sesja.
2. Nieznany pakiet, typ klienta spoza allowlisty, czas emisji spoza 7/30/90.
3. Klient przesyła spreparowane `amount`, `currency`, `status`, `userId` lub pola Stripe — nie wpływają na kwotę ani uprawnienia.
4. Salon innego użytkownika, brak salonu i błąd odczytu własności.
5. Kwota zapisana w bazie jest dokładnie zgodna z katalogiem; brak dodatkowego narzutu.
6. Powtórzenie idempotentnego żądania nie tworzy drugiego zamówienia; ponowne użycie klucza z innym payloadem kończy się `409`.
7. Błąd zapisu nie zwraca sukcesu i nie tworzy sesji Stripe.
8. Zamówienie początkowo ma status `pending`; kampania nie jest automatycznie aktywowana.
9. Brak konfiguracji/schematu kończy się bezpiecznie, bez zapisu.

## Blokady

- Nie stosować migracji do Supabase bez oddzielnej zgody i potwierdzenia środowiska testowego.
- Nie dodawać sekretów Stripe do kodu ani logów.
- Nie włączać Checkout ani nie zmieniać `payable: false` przed testami integracyjnymi i przeglądem.
- Nie zmieniać zatwierdzonych cen katalogowych.
- Nie scalać tej gałęzi do `main` bez osobnej zgody.

Ten dokument opisuje kontrakt do wdrożenia; nie twierdzi, że endpoint, schemat bazy ani testy integracyjne już istnieją.
