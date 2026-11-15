# LUMAR — przygotowanie migracji reklamowej na produkcję

Data audytu: 2026-11-15  
Status: **PRZYGOTOWANE DO REVIEW — NIC NIE ZASTOSOWANO NA PRODUKCJI**

## Zakres

Pakiet zawiera trzy migracje schematu bazy danych oraz selektywnie przeniesiony kod modułu reklamowego. Same pliki SQL obejmują:
- kampanie reklamowe,
- zamówienia i snapshot ceny,
- zdarzenia emisji,
- inbox webhooków Stripe,
- klucz idempotencji i atomowe utworzenie zamówienia,
- atomowe przejście opłaconego zamówienia do moderacji.

PR zawiera też API reklamowe, katalog cenowy, moduł Stripe w trybie testowym, stronę oferty, historię zamówień i panel moderacji. Testowy Checkout i webhook są blokowane przy `VERCEL_ENV=production`; helper Stripe akceptuje wyłącznie klucze `sk_test_`. Nie zawiera płatności live ani zmian sekretów Vercel. Po płatności kampanie trafiają wyłącznie do `pending_review`; baza nie aktywuje reklam samodzielnie.

## Ustalenia z audytu

### Produkcja
- Projekt produkcyjny: `cnfrbelkckbtkzhwyxqm`.
- Tabele `ad_*` nie istnieją w schemacie `public`.
- Historia migracji produkcji kończy się na `20261024115901_drop_global_appointment_time_unique`.
- Nie wykonano żadnego zapisu ani DDL na produkcji.

### Preview
- Projekt testowy: `vicfscuointkoksevocs`.
- Istnieją tabele `ad_campaigns`, `ad_orders`, `ad_events`, `ad_order_idempotency`, `ad_stripe_webhook_events`.
- Istnieją RPC `lumar_create_advertising_order` i `lumar_apply_advertising_payment_success`.
- Rzeczywiste definicje kolumn, ograniczeń i funkcji porównano z pakietem migracji.
- W Preview wszystkie pięć tabel ma RLS włączone, ale nie ma polityk. Role `anon` i `authenticated` mają jednak szerokie granty tabelowe. RLS bez polityk blokuje im dostęp do wierszy, ale granty niepotrzebnie pozostają. Nowy pakiet jawnie odbiera granty `PUBLIC`, `anon` i `authenticated`, pozostawiając dostęp serwerowy `service_role`.
- Obie funkcje RPC mają EXECUTE wyłącznie dla `service_role`. W nowym pakiecie zachowano ten model i zawężono `search_path` funkcji SECURITY DEFINER do `pg_catalog`; odwołania do tabel są kwalifikowane schematem `public`.

### Różnica historii migracji
Preview ma trzy wpisy reklamowe w swoim ledgerze pod wersjami z 1 listopada 2026. Nazwy i wersje tych wpisów nie odpowiadają dokładnie timestampom plików draft w gałęzi feature. Produkcja nie ma tych wpisów. Nie należy kopiować ani naprawiać historii Preview na produkcji. Nowe pliki mają nowe timestampy po ostatniej migracji produkcyjnej i tworzą schemat od zera.

## Zawartość pakietu

1. `20261115171000_lumar_advertising_base.sql` — cztery podstawowe tabele, indeksy, RLS, jawne granty.
2. `20261115171100_lumar_advertising_order_creation.sql` — tabela idempotencji i RPC tworzące kampanię oraz zamówienie w jednej transakcji.
3. `20261115171200_lumar_advertising_atomic_payment.sql` — RPC rozliczające zweryfikowany webhook w jednej transakcji i ustawiające kampanię na `pending_review`.

## Warunki przed zastosowaniem na produkcji

- Wykonać backup i potwierdzić docelowy projekt po jego ref.
- Przejrzeć SQL i porównać go z aktualnym schematem produkcyjnym bez założeń o stanie Preview.
- Uruchomić migracje na odizolowanej bazie testowej, następnie wykonać testy:
  - RLS/grants: brak bezpośredniego dostępu `anon` i `authenticated`; dostęp serwerowy `service_role`.
  - RPC: brak EXECUTE dla `PUBLIC`, `anon`, `authenticated`; EXECUTE dla `service_role`.
  - idempotencja: równoległe żądania z tym samym kluczem, ponowne użycie klucza z innym hashem, rollback przy błędzie.
  - płatności: niezgodny event/session/order/kwota/waluta/mode; duplikat eventu; równoległe webhooki; kampania zawsze `pending_review` po płatności.
  - integracja: utworzenie Checkout, zapis session ID, ponowienie żądania, wygaśnięcie sesji i ponowna próba.
- Sprawdzić Supabase Security Advisors po zastosowaniu.
- Kod aplikacji został już przeniesiony selektywnie do tej gałęzi opartej o aktualny `main`; nie scalono całej gałęzi `feature/lumar-advertising-plan`.
- CI ma uruchamiać `npm test`, `npm run typecheck` i `npm run build`. Vercel Preview dla nowej gałęzi wymaga osobnego przypisania zmiennych Supabase; nie kopiowano automatycznie branch-scoped sekretów z `debug/lumar-orders-preview`.
- Wdrożyć bazę i aplikację jako osobne, kontrolowane kroki. Płatności live pozostają wyłączone do osobnej decyzji prawno-księgowej.

## Istotne ograniczenia

- `SECURITY DEFINER` RPC zakłada, że route najpierw uwierzytelni użytkownika, zweryfikuje własność salonu i wyliczy cenę z serwerowego katalogu. Funkcja nie zastępuje tych kontroli.
- Webhook musi weryfikować podpis na surowym body, status paid, tryb, kwotę, walutę i zgodność Checkout Session. RPC nie weryfikuje podpisu Stripe.
- `service_role` nie może trafić do klienta ani zmiennej `NEXT_PUBLIC_*`.
- Migracje są celowo bez `IF NOT EXISTS`: jeśli obiekt pojawi się niespodziewanie przed wdrożeniem, migracja ma przerwać pracę zamiast po cichu zaakceptować nieznany stan.
- Ten PR nie stosuje migracji do żadnego projektu Supabase i nie uruchamia płatności live. Testowy Checkout jest dostępny wyłącznie poza wdrożeniem produkcyjnym.

## Zmiany poza zakresem

Nie zmieniono:
- produkcyjnej bazy Supabase,
- produkcyjnych env vars ani sekretów Stripe,
- `main`,
- logiki rezerwacji, salonów ani klientów,
- statusów istniejących zamówień Preview.
