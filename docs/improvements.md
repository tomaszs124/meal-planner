# Backlog ulepszeń aplikacji

Dokument roboczy na przyszłość: co warto poprawić, dlaczego i w jakiej kolejności.
Powstał 2026-10-04 po przeglądzie kodu przy okazji budowy konektora MCP.
Status: `[ ]` do zrobienia, `[x]` zrobione (z odnośnikiem do commita/brancha).

Priorytet: **P1** daje odczuwalny efekt od razu, **P2** porządkuje kod pod dalszy rozwój,
**P3** potrzebne dopiero przy wersji komercyjnej.

---

## A. Wydajność: zapytania N+1

Każdy przypadek to pętla po rekordach z osobnym zapytaniem do Supabase na iterację.
Przy 50 przepisach i 2 domownikach daje to setki requestów na wejście w zakładkę,
co na telefonie przez LTE jest odczuwalne (sekundy ładowania).

- [x] **P1 Lista posiłków** (`src/components/Meals/Meals.tsx`, `fetchMeals` ok. linii 408-500): na każdy posiłek 4 zapytania (nadpisania, składniki, tagi, zdjęcia). Docelowo: 1 zapytanie o posiłki + 4 zapytania zbiorcze `.in('meal_id', ids)` i składanie w pamięci. Wzorzec jest już napisany w `src/lib/mcp/data.ts` (`loadMealsDetailed`) na branchu `feature/mcp-connector`.
- [x] **P1 Planer: ładowanie posiłków** (`src/components/MealPlanner/MealPlanner.tsx` ok. linii 140-200): ten sam wzorzec co wyżej.
- [x] **P1 Planer: postęp tygodnia** (`MealPlanner.tsx`, `fetchWeekProgress` ok. linii 300-345): 7 zapytań dziennych zamiast jednego `gte/lte` na zakres tygodnia. Dodatkowo efekt zależy od `plannedMeals`, więc odpala się ponownie po każdej zmianie w dniu.
- [x] **P1 Generowanie listy zakupów** (`src/components/ShoppingList/ShoppingListEnhanced.tsx`, ok. linii 427-500): per wpis planu 1-2 zapytania o nadpisania/składniki. Docelowo: 2 zapytania zbiorcze dla wszystkich par (posiłek, użytkownik).
- [x] **P2 Modal wyboru posiłku** (`src/components/MealPlanner/MealPickerModal.tsx`, ok. linii 70-115): N+1 jak w liście posiłków; ponadto ładuje wszystko od nowa przy każdym otwarciu. Mógłby dostać gotowe dane z planera.
- [ ] **P2 Produkty ładowane w całości na każdej stronie**: przy kilkuset produktach nadal OK, ale warto przejść na jeden współdzielony hook z cache (np. prosty kontekst albo React Query), żeby nie pobierać ich osobno w posiłkach, planerze i liście zakupów.

## B. Jakość kodu

- [x] **P1 Jedno źródło prawdy dla obliczeń odżywczych** (branch `chore/optimizations`): `calculateNutrition` jest skopiowana w 6 plikach (`MealDetailsModal`, `MealPickerModal`, `MealPlanner`, `MealSlot`, `Meals`, `MealsWithOverrides`) i siódmy raz w `src/lib/mcp/nutrition.ts`. Docelowo `src/lib/nutrition.ts` importowana wszędzie, z testami.
- [x] **P1 Martwy kod**: `src/components/Meals/MealsWithOverrides.tsx` i `src/components/ShoppingList/ShoppingList.tsx` nie są nigdzie importowane. Strona `src/app/debug/page.tsx` wystawia surowe dane użytkownika i gospodarstwa; w produkcji nie powinna istnieć (albo tylko w `NODE_ENV=development`).
- [ ] **P2 Rozmiar komponentów**: `Meals.tsx` 2317 linii, `ShoppingListEnhanced.tsx` 1668, `MealPlanner.tsx` 1040, `Products.tsx` 999. Każdy trzyma pobieranie danych, formularze i widok. Docelowo: hooki danych (`useMeals`, `useShoppingList`, `useMealPlan`) + komponenty prezentacyjne (formularz posiłku, karta posiłku, grupa zakupów). Robić dopiero po dodaniu testów logiki, inaczej refaktor jest ślepy.
- [x] **P2 Typy `any`**: `src/middleware.ts` (2 błędy lintu), `src/app/debug/page.tsx` (4). Lint (`npm run lint`) obecnie nie przechodzi na czysto.
- [ ] **P3 Pozostałe `console.log`** w kodzie produkcyjnym (5 miejsc), do usunięcia lub zamiany na logger.

## C. Baza danych i typy

- [ ] **P2 Migracje jako numerowana historia**: dziś 33 luźne pliki SQL w `docs/` bez kolejności i bez informacji, które zostały wykonane. Docelowo Supabase CLI (`supabase/migrations/<timestamp>_<nazwa>.sql`, `supabase db push`), a `docs/database-schema.sql` jako zrzut aktualnego stanu.
- [ ] **P2 Typy generowane z bazy** (`supabase gen types typescript`) zamiast ręcznie pisanych w `src/lib/supabase/client.ts`. Już się rozjechały: typ `MealPlan` nie ma `is_skipped`, którego UI używa; typ `UserSettings` ma część pól opcjonalnych "na wszelki wypadek".
- [ ] **P2 Spójność RLS**: pierwotne polityki `meal_plan` to "tylko własne wiersze", a aplikacja czyta plany domowników (kopiowanie dnia, lista zakupów dla obojga). Działa, bo kolejne migracje poluzowały polityki, ale warto raz przejrzeć wszystkie polityki pod kątem "domownik widzi dane gospodarstwa, obcy nie widzi nic" i spisać je w jednym pliku.
- [ ] **P2 Pole liczby dni/porcji na posiłku** (`servings_days`): "gotuję na 2 dni" jest dziś tekstem w opisie i obejściem przez porcje w `shopping_list_state`. Jawne pole pozwoli planerowi i liście zakupów liczyć to samo bez ręcznego skalowania.
- [ ] **P3 Indeksy pod realne zapytania**: `meal_plan(household_id, date)` dla zakresów tygodnia i generowania zakupów (dziś jest `user_id, date`).

## D. UX

- [x] **P1 Natywne `alert`/`confirm`**: 49 wystąpień. Na telefonie w trybie PWA wyglądają obco, blokują wątek i nie da się ich ostylować. Docelowo: komponent toast (sukces/błąd) i modal potwierdzenia, jeden na całą aplikację.
- [x] **P1 Brak manifestu PWA**: dokument założeń mówi o instalacji jak aplikacja, ale w `public/` nie ma `manifest.json` ani ikon, a `layout.tsx` go nie linkuje. Bez tego nie ma "Dodaj do ekranu głównego" z pełnym ekranem.
- [ ] **P2 Stany ładowania i błędów**: większość widoków pokazuje "Ładowanie..." tekstem; brak skeletonów i brak obsługi utraty sieci (lista zakupów w sklepie bez zasięgu).
- [x] **P2 Obrazki**: `<img>` zamienione na `next/image` (MealSlot); przy zdjęciach z telefonu (kilka MB) warto wymusić kompresję przy uploadzie.
- [ ] **P3 Tryb offline** dla listy zakupów (service worker + kolejka zmian), realny scenariusz w sklepie.

## E. Inżynieria

- [x] **P1 Testy jednostkowe** (Vitest, 26 testów: nutrition, meals-data, shopping; dalsze do dopisania) logiki czystej: obliczenia kcal, ułamki opakowań, agregacja listy zakupów, skalowanie porcji, "unikalne wpisy per slot". Vitest, bez przeglądarki. Zero testów dziś.
- [x] **P2 CI** (GitHub Actions): lint + typecheck + testy + build na każdym PR. Brak `.github/`.
- [x] **P2 `middleware.ts` → `proxy.ts`**: Next 16 ostrzega przy buildzie, że konwencja middleware jest przestarzała.
- [x] **P2 Walidacja zmiennych środowiskowych** przy starcie (np. mały moduł `env.ts` rzucający czytelny błąd), zamiast `!` na `process.env`.
- [ ] **P3 Obserwowalność**: Sentry lub odpowiednik na błędy frontu i route handlerów; dziś błędy giną w `console.error`.

## F. Droga do wersji komercyjnej (P3, ale warto mieć przed oczami)

Aplikacja jest dziś zbudowana pod jedno gospodarstwo dwóch osób. Żeby ją sprzedawać,
potrzebne są rzeczy, których nie da się dorobić na końcu bez przepisywania:

1. **Wielu najemców naprawdę odseparowanych**: audyt RLS na każdej tabeli (w tym `storage` ze zdjęciami), testy automatyczne "użytkownik A nie widzi danych gospodarstwa B", brak kluczy service role w ścieżkach użytkownika.
2. **Onboarding i zaproszenia**: tworzenie gospodarstwa, zapraszanie domownika linkiem/e-mailem, role (właściciel/członek), opuszczanie gospodarstwa, usuwanie konta z danymi (RODO: eksport i kasowanie).
3. **Logowanie**: magic link / Google / Apple obok hasła, reset hasła, weryfikacja e-maila, e-maile transakcyjne z własnej domeny.
4. **Baza produktów startowa**: nowy użytkownik nie może zaczynać od pustej listy produktów. Potrzebna publiczna baza (np. Open Food Facts) z kopiowaniem do gospodarstwa, skanowanie kodów kreskowych z telefonu.
5. **Model płatności**: Stripe (subskrypcja per gospodarstwo), plan darmowy z limitami, strona cennika, faktury. Decyzja, co jest płatne (np. asystent AI, więcej domowników, historia).
6. **Asystent AI jako funkcja produktu**: dzisiejszy konektor MCP działa z zewnętrznym ChatGPT. W produkcie asystent powinien być w aplikacji (Claude API po stronie serwera), per użytkownik, z OAuth zamiast współdzielonego tokenu, z limitami użycia i logiem zmian ("co AI zmieniło").
7. **Prawo i zaufanie**: regulamin, polityka prywatności, zgody na cookies, informacja, że kalorie są szacunkowe (nie porada medyczna). Dane zdrowotne z sekcji 2.6 założeń (masa, wypróżnienia) to dane wrażliwe: albo wyraźna zgoda i szyfrowanie, albo rezygnacja z tej części w wersji publicznej.
8. **Operacje**: kopie zapasowe i test odtwarzania, środowisko staging, monitoring, limit zapytań na publicznych endpointach, polityka wersjonowania migracji, koszty Supabase/Vercel przy 1k gospodarstw.
9. **Jakość produktu**: i18n (dziś polskie teksty na sztywno w JSX), dostępność (etykiety, kontrast), onboarding w aplikacji, strona marketingowa.
10. **Metryki**: analityka zdarzeń (ile osób planuje tydzień, ile generuje zakupy), żeby decyzje o funkcjach były oparte na danych.

## G. Pomysły produktowe

### Promocje Lidla w planowaniu posiłków (pomysł z 2026-10-04)

Cel: podpowiadać posiłki, których składniki są akurat w promocji (kupony Lidl Plus, gazetka).

Źródła danych, od najpewniejszego:

1. **Gazetka lidl.pl** (publiczna, co tydzień): pobieranie cronem (Vercel Cron) ze strony ofert, parsowanie nazw, cen i dat ważności. Bez logowania, stabilne, legalne. Brak kuponów spersonalizowanych.
2. **Zrzuty ekranu z Lidl Plus**: użytkownik wysyła screenshot do asystenta (ChatGPT/Claude), model odczytuje kupony i zapisuje je przez narzędzie MCP `import_promotions`. Działa od razu, ręczne raz w tygodniu.
3. **Nieoficjalny klient Lidl Plus** (biblioteki open source odtworzone z aplikacji; logowanie kontem użytkownika, dostęp do kuponów i paragonów). Paragony pozwoliłyby automatycznie uzupełniać `package_size` i ceny produktów. Ryzyka: łamie się po aktualizacjach aplikacji, logowanie z kodem SMS, niezgodne z regulaminem Lidla. Tylko na własny użytek, nie do wersji komercyjnej.

Model danych: tabela `promotions` (`household_id`, `product_id` nullable, `raw_name`, `store`, `price`, `discount_text`, `valid_from`, `valid_to`, `source`: flyer | screenshot | api) oraz `product_aliases` (nazwa ze sklepu → produkt), żeby dopasowanie po pierwszym razie było automatyczne.

Funkcje: odznaka "promocja" na karcie posiłku i w modalu wyboru do planu; filtr "w promocji" na liście posiłków; w MCP `list_promotions`, `import_promotions`, `suggest_meals_on_promotion` (punktacja przepisu = udział składników w promocji ważony ceną; podpowiedź "zaplanuj w tym tygodniu"). Dopasowanie nazw kuponów do produktów robi model, aliasy zapamiętywane.

Kolejność: gazetka + zrzuty ekranu najpierw, klient Lidl Plus jako eksperyment.

---

## Plan realizacji na branchu `chore/optimizations`

Kolejność dobrana tak, żeby każdy krok był osobnym, odwracalnym commitem i żeby testy
powstały zanim ruszę większe refaktory.

1. [x] `src/lib/nutrition.ts` + Vitest z testami, podmiana 6 kopii `calculateNutrition`.
2. [x] N+1 w liście posiłków (`Meals.tsx`).
3. [x] N+1 w planerze (ładowanie posiłków + postęp tygodnia).
4. [x] N+1 w generowaniu listy zakupów.
5. [x] N+1 w modalu wyboru posiłku.
6. [x] Usunięcie martwego kodu i wyłączenie strony debug poza developmentem.
7. [x] `middleware.ts` → `proxy.ts`, typy zamiast `any`, lint na czysto.
8. [x] Typ `MealPlan` z `is_skipped`.
9. [x] Manifest PWA + ikony.
10. [x] Toast i modal potwierdzenia zamiast `alert`/`confirm` (największa zmiana, na końcu).
