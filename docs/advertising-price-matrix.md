# LUMAR — zatwierdzony cennik reklamowy

Waluta: PLN. Wszystkie kwoty są netto. VAT doliczany zgodnie z konfiguracją systemu. Kwot nie wolno zmieniać bez wyraźnej zgody właściciela produktu.

## 1. Wyróżnienie na liście salonów / firm
Opis: wyższa pozycja na liście oraz wyróżnienie profilu.

| Typ klienta | 7 dni | 30 dni | 90 dni |
|---|---:|---:|---:|
| salon_w_aplikacji | 49 zł | 149 zł | 349 zł |
| firma_zewnetrzna | 99 zł | 299 zł | 699 zł |

## 2. Wyróżniony profil + badge „Polecany”
Opis: badge „Polecany” i wyróżniony profil. Materiał musi być jednocześnie czytelnie oznaczony jako „Reklama”.

| Typ klienta | 7 dni | 30 dni | 90 dni |
|---|---:|---:|---:|
| salon_w_aplikacji | 59 zł | 169 zł | 399 zł |
| firma_zewnetrzna | 119 zł | 349 zł | 799 zł |

## 3. Baner w aplikacji
Opis: baner graficzny w wybranej sekcji aplikacji.

| Typ klienta | 7 dni | 30 dni | 90 dni |
|---|---:|---:|---:|
| salon_w_aplikacji | 129 zł | 349 zł | 799 zł |
| firma_zewnetrzna | 219 zł | 599 zł | 1 299 zł |

## 4. Baner na ekranie głównym
Opis: baner na ekranie startowym aplikacji.

| Typ klienta | 7 dni | 30 dni | 90 dni |
|---|---:|---:|---:|
| salon_w_aplikacji | 199 zł | 599 zł | 1 399 zł |
| firma_zewnetrzna | 349 zł | 999 zł | 2 199 zł |

## 5. Karuzela / post sponsorowany
Opis: sponsorowany post lub karuzela w aplikacji.

| Typ klienta | 7 dni | 30 dni | 90 dni |
|---|---:|---:|---:|
| salon_w_aplikacji | 89 zł | 229 zł | 549 zł |
| firma_zewnetrzna | 149 zł | 399 zł | 899 zł |

## Reguły produktu
- Cennik jest zdefiniowany w jednym miejscu: `lib/advertising/catalog.ts`.
- Kwota do zapłaty musi być wyliczana na serwerze z tego katalogu; kwota z przeglądarki nigdy nie może być źródłem prawdy.
- Typ klienta musi być potwierdzony: salon w aplikacji powinien być powiązany z salonem, którego jest właścicielem; firma zewnętrzna nie może być przedstawiana jako salon.
- Wszystkie płatne emisje muszą być oznaczone „Reklama”. Badge „Polecany” nie może zastępować oznaczenia reklamy.
- Start kampanii dopiero po potwierdzeniu płatności po stronie serwera i akceptacji moderacyjnej. Długość emisji: dokładnie wybrane 7, 30 lub 90 dni od zatwierdzonego startu.
- Brak automatycznego rabatu, zmiany ceny, łączenia pakietów ani doliczania VAT w katalogu.
- Ta tabela dokumentuje zatwierdzony cennik. Nie oznacza jeszcze, że checkout, aktywacja kampanii, VAT czy emisja są już wdrożone.
