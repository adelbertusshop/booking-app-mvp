# LUMAR — migracje reklamowe i plan testów

Data wdrożenia schematu: 2026-11-15  
Status: **TRZY MIGRACJE ZASTOSOWANE NA PRODUKCJI; TESTY APLIKACYJNE I PG TAP W TOKU**

## Stan produkcji po wdrożeniu

Projekt produkcyjny: `cnfrbelkckbtkzhwyxqm`.

Zastosowano trzy migracje:

1. `20261115161707_lumar_advertising_base.sql`
2. `20261115161709_lumar_advertising_order_creation.sql`
3. `20261115161712_lumar_advertising_atomic_payment.sql`

Historia migracji Supabase potwierdza wszystkie trzy wpisy. Po wdrożeniu zweryfikowano:

- pięć tabel reklamowych istnieje: `ad_campaigns`, `ad_orders`, `ad_events`, `ad_stripe_webhook_events`, `ad_order_idempotency`;
- RLS jest włączone na wszystkich pięciu tabelach;
- tabele nie mają bezpośrednich grantów dla `PUBLIC`, `anon` ani `authenticated`;
- dostęp tabelowy otrzymał `service_role`;
- obie funkcje RPC są `SECURITY DEFINER`, mają `search_path=pg_catalog` i EXECUTE dla `service_role`, bez EXECUTE dla `anon` i `authenticated`;
- nowe tabele są puste — migracje nie przenosiły ani nie tworzyły zamówień;
- istniejące tabele rezerwacji, salonów i klientów nie były modyfikowane przez te migracje.

Nie uruchomiono płatności live ani nie wdrożono nowego kodu reklamowego na produkcję.

## Bezpieczeństwo — wynik po migracjach

Supabase Security Advisor po wdrożeniu zgłosił:

- pięć informacji `RLS Enabled No Policy` dla nowych tabel reklamowych — to zamierzony model: RLS jest włączone, ale dostęp do tabel jest odebrany rolom klienckim; dostęp odbywa się przez serwerowe API z `service_role`;
- trzy podobne informacje dotyczące istniejących tabel `admin_settings`, `bookings` i `providers` — nie są częścią wdrożenia reklam;
- ostrzeżenie o wyłączonej ochronie haseł przed hasłami ujawnionymi w wyciekach — ustawienie Auth do osobnego przeglądu.

Health Advisor nie zwrócił problemów.

## Kod aplikacji

Kod reklamowy został selektywnie przeniesiony do gałęzi opartej na aktualnym `main`; nie scalono całej gałęzi `feature/lumar-advertising-plan`.

- API: checkout, moderation, orders, public, quote, webhook.
- Strony: oferta reklam, historia zamówień, panel moderacji.
- Checkout i webhook testowy mają blokadę przy `VERCEL_ENV=production`.
- Helper Stripe przyjmuje wyłącznie klucze `sk_test_`.
- Po potwierdzeniu płatności kampania przechodzi do `pending_review`, nigdy automatycznie do `active`.
- Płatności live pozostają wyłączone do osobnej decyzji prawno-księgowej.

## Testy lokalne Supabase / pgTAP

Dodano:

- `supabase/tests/database/advertising_security.test.sql` — 20 asercji struktury, RLS, grantów, funkcji i uprawnień;
- `supabase/tests/fixtures/salon_prerequisite.sql.fixture` — minimalne testowe tabele `public.salons` i `public.appointments`, potrzebne do odtworzenia wcześniejszej migracji rezerwacji oraz FK reklam; używane wyłącznie lokalnie;
- `scripts/test-advertising-db.mjs` — uruchamia lokalny Supabase, wykonuje testy i usuwa tymczasową migrację-fixture;
- skrypt npm: `npm run test:db`.

Fixture jest kopiowany tymczasowo do katalogu migracji pod wersją wcześniejszą niż starsza migracja rezerwacji, aby lokalna, czysta baza miała minimalną tabelę `salons`. Skrypt usuwa ten plik po teście. Fixture nie jest migracją produkcyjną i nie może być wdrażany na zdalny projekt.

Wymagania do uruchomienia lokalnego: Docker Desktop uruchomiony oraz Supabase CLI dostępny przez `npx`. W katalogu projektu:

```bash
npx supabase init
npm run test:db
```

Jeśli `supabase/config.toml` już istnieje, pomiń `npx supabase init`. Po zakończeniu można zatrzymać lokalny stos:

```bash
npx supabase stop
```

Testy pgTAP obejmują na tym etapie strukturę i granice dostępu. Nie zastępują jeszcze testów transakcyjnych RPC, równoległych żądań, duplikatów webhooków ani testów pełnego przepływu Stripe. Te przypadki pozostają kolejnym etapem.

## CI

Workflow GitHub Actions uruchamia:
- `npm test`,
- `npm run test:db` (lokalny Supabase + pgTAP),
- `npm run typecheck`,
- `npm run build`.

Poprzedni przebieg CI przed dodaniem pgTAP zakończył się sukcesem dla testów Node, typecheck i build. Nowy przebieg musi jeszcze potwierdzić działanie testów bazodanowych.

## Ograniczenia i zabezpieczenia

- Nie wykonano testu na odizolowanej zdalnej gałęzi, ponieważ plan Supabase nie udostępnia tej funkcji.
- Lokalny Docker nie jest dostępny w środowisku wykonawczym asystenta; test pgTAP ma być uruchomiony przez CI i lokalnie na komputerze deweloperskim.
- Nie kopiowano sekretów Vercel ani Supabase pomiędzy środowiskami.
- Route musi uwierzytelnić użytkownika, sprawdzić własność salonu i pobrać cenę z katalogu serwerowego przed wywołaniem RPC.
- Webhook musi zweryfikować podpis na surowym body, status płatności, tryb, kwotę, walutę i zgodność Checkout Session. Funkcja SQL nie weryfikuje podpisu Stripe.
- Znany przypadek do przetestowania: ponowienie checkoutu po wygaśnięciu sesji Stripe i zachowanie klucza idempotencji.
- Nie wolno umieszczać `service_role` w kliencie ani w zmiennych `NEXT_PUBLIC_*`.

## Linki robocze

- Pull request: https://github.com/adelbertusshop/booking-app-mvp/pull/17
- Testy lokalne: `npm run test:db`
