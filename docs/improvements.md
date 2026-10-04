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
- [x] **P2 Rozmiar komponentów**: zrobione dla `Meals.tsx` (2230 → 197 linii, 14 modułów, jeden formularz add/edit), `ShoppingListEnhanced.tsx` (1595 → 231, 11 modułów), `MealPlanner.tsx` (973 → 170, hook `useMealPlan` + `src/lib/plan.ts` z 18 testami). `Products.tsx` w trakcie. Refaktor był przenoszeniem kodu, nie przepisywaniem; **wymaga przeklikania w przeglądarce** (lista w sekcji "Do sprawdzenia ręcznie" poniżej).
- [x] **P2 Typy `any`**: `src/middleware.ts` (2 błędy lintu), `src/app/debug/page.tsx` (4). Lint (`npm run lint`) obecnie nie przechodzi na czysto.
- [x] **P3 Pozostałe `console.log`** usunięte (5 miejsc); `console.error` zostaje do czasu wdrożenia loggera/Sentry.

### Do sprawdzenia ręcznie po refaktorach (brak dostępu do zalogowanej sesji w tej pracy)

- [ ] Posiłki: dodanie posiłku ze zdjęciem, tagami i wariantem domownika; edycja (podmiana zdjęcia, usunięcie wariantu); usunięcie z potwierdzeniem; filtry i akordeon kategorii; realtime tagów.
- [ ] Planer: wybór posiłku do slotu (modal dostaje posiłki z planera, bez własnego zapytania), losowanie, zjedzone/pominięte, duplikuj z wczoraj, kopiuj od domownika, wyślij domownikowi, pasek postępu tygodnia.
- [ ] Lista zakupów: generowanie z planu (dialog "Wyczyść/Zachowaj"), odhaczanie, szybkie klikanie +/− porcji, usuwanie dania, widok wg kategorii i wg dania, odświeżanie realtime na dwóch urządzeniach, listy własne.
- [ ] Produkty: dodanie/edycja/usunięcie z rollbackiem, kategorie, cache między zakładkami (Posiłki widzą nowy produkt bez odświeżania).
- [ ] Toasty i modal potwierdzenia na telefonie (pozycja nad dolną nawigacją, Escape, klik w tło).
- [ ] PWA: "Dodaj do ekranu głównego" na Androidzie/iOS, ikona, kolor paska.

## C. Baza danych i typy

- [ ] **P2 Migracje jako numerowana historia**: dziś 33 luźne pliki SQL w `docs/` bez kolejności i bez informacji, które zostały wykonane. Docelowo Supabase CLI (`supabase/migrations/<timestamp>_<nazwa>.sql`, `supabase db push`), a `docs/database-schema.sql` jako zrzut aktualnego stanu.
- [ ] **P2 Typy generowane z bazy** (`supabase gen types typescript`) zamiast ręcznie pisanych w `src/lib/supabase/client.ts`. Już się rozjechały: typ `MealPlan` nie ma `is_skipped`, którego UI używa; typ `UserSettings` ma część pól opcjonalnych "na wszelki wypadek".
- [x] **P2 Spójność RLS**: audyt statyczny gotowy w [`docs/rls-audit.md`](./rls-audit.md) (tabela po tabeli, werdykty, testy do napisania). Wynik: **jedna luka krytyczna** (każdy zalogowany może dopisać się do dowolnego gospodarstwa jako owner), dwie wysokie (funkcja `get_user_household_ids` odpowiada o cudze gospodarstwa i jest dostępna dla anon; `profiles` czytelne publicznie), reszta średnia/niska.
- [ ] **P1 Wdrożenie poprawek RLS**: uruchomić [`docs/rls-hardening.sql`](./rls-hardening.sql) w SQL Editorze (poprawki #1-#4, #6, #10 z audytu; idempotentne; MCP nie dotyczy, bo service role omija RLS). Potem przeklikać: logowanie, lista posiłków, kopiowanie dnia domownika, generowanie zakupów dla obojga. Decyzje do podjęcia osobno: publiczny bucket zdjęć (#5), `visible_to` list własnych (#7).
- [ ] **P2 Testy negatywne RLS**: checklista w sekcji 4 audytu; do automatyzacji po migracji na Supabase CLI (lokalna baza w CI).
- [ ] **P2 Pole liczby dni/porcji na posiłku** (`servings_days`): "gotuję na 2 dni" jest dziś tekstem w opisie i obejściem przez porcje w `shopping_list_state`. Jawne pole pozwoli planerowi i liście zakupów liczyć to samo bez ręcznego skalowania.
- [ ] **P3 Indeksy pod realne zapytania**: `meal_plan(household_id, date)` dla zakresów tygodnia i generowania zakupów (dziś jest `user_id, date`).

## D. UX

- [x] **P1 Natywne `alert`/`confirm`**: 49 wystąpień. Na telefonie w trybie PWA wyglądają obco, blokują wątek i nie da się ich ostylować. Docelowo: komponent toast (sukces/błąd) i modal potwierdzenia, jeden na całą aplikację.
- [x] **P1 Brak manifestu PWA**: dokument założeń mówi o instalacji jak aplikacja, ale w `public/` nie ma `manifest.json` ani ikon, a `layout.tsx` go nie linkuje. Bez tego nie ma "Dodaj do ekranu głównego" z pełnym ekranem.
- [x] **P2 Stany ładowania i błędów**: szkielety dopasowane do układu w 6 ekranach (`src/components/ui/Skeleton.tsx`), granice błędów `src/app/error.tsx` i `global-error.tsx`, strona 404. Zostało: obsługa utraty sieci (lista zakupów w sklepie bez zasięgu) → patrz tryb offline poniżej.
- [x] **P2 Obrazki**: `<img>` zamienione na `next/image` (MealSlot); zdjęcia są kompresowane w przeglądarce przed uploadem (`src/lib/image.ts`: max 1600 px, JPEG 0.82, GIF bez zmian, PNG/WebP zachowane tylko przy przezroczystości). Ścieżka przeglądarkowa do sprawdzenia na telefonie.
- [x] **P3 Tryb offline (odczyt)**: service worker `public/sw.js` (tylko produkcja): statyczne pliki i zdjęcia cache-first, nawigacje i odczyty z Supabase network-first z 4 s limitem i zapasem z cache, baner "Brak połączenia". Opis i instrukcja testu: [`offline.md`](./offline.md). **Do sprawdzenia na telefonie** (instalacja SW, lista zakupów offline po pełnym przeładowaniu). Zostało: kolejka zmian offline (zapisy w sklepie bez zasięgu).
- [ ] **P3 Zagnieżdżone kontrolki w wierszach**: wiersze listy zakupów i karty mają `role="button"` z checkboxem i przyciskami w środku (czytniki ekranu mogą je spłaszczać). Docelowo klik na obszar tekstu zamiast całego wiersza albo checkbox jako jedyny element aktywny.

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
9. **Jakość produktu**: i18n (dziś polskie teksty na sztywno w JSX), dostępność (etykiety, kontrast), onboarding w aplikacji, strona marketingowa. Postęp 2026-10-04: dwa przejścia a11y (etykiety, role dialogów, Escape, klawiatura w wierszach, pułapka fokusu); zostaje kontrast i audyt czytnikiem ekranu.
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

## Branche (stan 2026-10-04)

- `feature/mcp-connector`: konektor MCP + pole opakowania produktu (lista zadań: `docs/mcp/TODO.md`).
- `chore/optimizations`: wszystko z tego dokumentu oznaczone `[x]`.
- `integration/mcp-and-optimizations`: scalenie obu z rozwiązanymi konfliktami (`proxy.ts` zamiast middleware, pole opakowania przeniesione do podzielonych modułów produktów, lock npm odtworzony). Typy, lint, testy i build przechodzą. Jeśli ma wejść całość, najprościej scalić ten branch do `main`; jeśli osobno, najpierw MCP, potem optymalizacje i rozwiązać te same trzy konflikty.

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
