# Architektura aplikacji (stan po refaktorze z 2026-10-04)

Dokument dla osoby (lub asystenta AI), która ma szybko wejść w kod. Opisuje warstwy, konwencje
i miejsca, gdzie szukać logiki. Historia zmian i backlog: [`improvements.md`](./improvements.md).

## 1. Warstwy

```
src/app/              trasy App Routera, layout z providerami, granice błędów, manifest PWA
src/components/<F>/   jedna funkcja biznesowa = jeden katalog (Meals, MealPlanner, ShoppingList, Products, Settings)
src/components/ui/    elementy współdzielone bez logiki domenowej (Feedback = toast + confirm, Skeleton)
src/components/Auth/  CurrentUserProvider (jedna subskrypcja auth dla całej aplikacji), LoginForm
src/hooks/            hooki współdzielone między katalogami (useCurrentUser, useProducts)
src/lib/              czysta logika bez Reacta i bez Supabase-klienta w sygnaturach: nutrition, plan,
                      shopping, meals-data (loader), image, env; każdy moduł ma plik *.test.ts obok
src/lib/supabase/     klient przeglądarkowy + ręcznie pisane typy tabel
src/proxy.ts          bramka auth (dawne middleware): niezalogowany → /login
docs/                 migracje SQL, audyt RLS, backlog, ten dokument
```

Zasada: **komponent = hook danych + elementy prezentacyjne**. Hook (`useMeals`, `useMealPlan`,
`useShoppingList`, `useProductCategories`) trzyma stan, zapytania do Supabase, aktualizacje
optymistyczne i subskrypcje realtime. Komponenty dostają dane i callbacki przez propsy.
Logika, którą da się policzyć bez Reacta, idzie do `src/lib` albo do `*Utils.ts`/`*Helpers.ts`
obok komponentu i dostaje test.

## 2. Przepływ danych

- **Autoryzacja**: `CurrentUserProvider` (w `layout.tsx`) subskrybuje `onAuthStateChange` raz,
  ładuje gospodarstwo (`household_users` → `households`) i udostępnia `useCurrentUser()`.
  Po logowaniu przez server action provider odczytuje sesję przy zmianie trasy.
- **Produkty**: `useProducts(householdId)` to cache w pamięci modułu (`useSyncExternalStore`),
  jeden kanał realtime na gospodarstwo, rewalidacja po 60 s i po zamknięciu kanału,
  `setProducts` dla aktualizacji optymistycznych widocznych we wszystkich zakładkach.
- **Posiłki**: `fetchMealsWithDetails` (`src/lib/meals-data.ts`) ładuje posiłki + składniki +
  nadpisania użytkownika + tagi + zdjęcia w 5 zapytaniach (zamiast 4 na posiłek). Wynik
  `MealWithDetails` ma `items` (efektywne składniki użytkownika), `baseItems`, `isUserVariant`
  i sumy kcal/makro. Używają go lista posiłków, planer i modal wyboru (planer przekazuje
  `allMeals` do modalu, więc modal nie pobiera nic sam).
- **Plan**: `useMealPlan` + czyste funkcje w `src/lib/plan.ts` (`getUniquePlansByMealType`,
  `buildWeekProgress`, `pickRandomMeal` z deterministycznym ziarnem data+kategoria,
  `getEnabledCategories`).
- **Zakupy**: generowanie z planu = 3 zapytania (plan, `meal_items`, `meal_item_overrides`) i
  agregacja w `src/lib/shopping.ts` (`collectPlanIngredients`, klucz grupy
  `meal_id:source_user_id`, porcje w `shopping_list_state.meal_servings`). Widoki: wg dania
  (`DishView`/`MealGroupCard`) i wg kategorii (`CategoryView` + `groupByCategory`).
- **Obliczenia odżywcze**: wyłącznie `src/lib/nutrition.ts` (`calculateNutrition`,
  `sumNutrition`, `formatAmount`). Wartości produktów są zawsze na 100 g;
  `unit_weight_grams` mówi, ile waży jedna jednostka (1 dla gramów).

## 3. Konwencje UI

- Komunikaty: `const { toast, confirm } = useFeedback()`. `alert`/`confirm` przeglądarki są
  zablokowane regułą ESLint. `confirm` zwraca `true` / `false` / `null` (zamknięcie Escape lub
  kliknięciem w tło); gdy "Anuluj" znaczy "kontynuuj bez", sprawdzaj `null` osobno.
- Ładowanie: szkielety z `components/ui/Skeleton.tsx` zamiast tekstu.
- Błędy stron: `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`.
- Teksty interfejsu po polsku, kod i commity po angielsku.
- Pliki w `src/components/**` mają końce linii CRLF (historycznie), `src/lib/**` LF. Narzędzia
  ich nie zmieniają; nie konwertuj hurtowo.
- Uwaga na Windows: nie twórz plików różniących się tylko wielkością liter
  (`MealFilters.tsx` vs `mealFilters.ts` psuje TypeScript) – stąd nazwy `*Utils.ts`.

## 4. Jakość

- `npm run lint` (CI: `--max-warnings=0`), `npx tsc --noEmit`, `npm test` (Vitest, ~130 testów),
  `npm run build`. Workflow w `.github/workflows/ci.yml`.
- Testujemy czyste funkcje; komponentów nie (brak jsdom). Nowa logika → najpierw funkcja w
  `lib`/`*Utils`, potem test, potem użycie w hooku.
- Weryfikacja ręczna po refaktorach: lista w `improvements.md`, sekcja "Do sprawdzenia ręcznie".

## 5. Baza danych

- Schemat i migracje: luźne pliki SQL w `docs/` (brak numeracji; docelowo Supabase CLI).
- Bezpieczeństwo: `docs/rls-audit.md` (stan polityk tabela po tabeli) i `docs/rls-hardening.sql`
  (proponowane poprawki, w tym krytyczna luka w `household_users`).
- Tabele kluczowe: `products`, `meals`, `meal_items`, `meal_item_overrides` (warianty per
  domownik), `meal_plan` (slot = user + data + typ posiłku), `shopping_list_items`,
  `shopping_list_state`, `custom_lists`, `user_settings`, `household_users`.

## 6. Konektor MCP (branch `feature/mcp-connector`)

Serwer pod `/api/mcp/<token>` z narzędziami do produktów, posiłków, planu i zakupów dla
ChatGPT/Claude; własna warstwa danych w `src/lib/mcp/`. Instrukcja: `docs/mcp/setup.md`,
lista zadań: `docs/mcp/TODO.md`. Po scaleniu z tym branchem warto, żeby MCP importował
`calculateNutrition` z `src/lib/nutrition.ts` zamiast własnej kopii.
