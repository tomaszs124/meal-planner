# Konektor MCP: co zostało do zrobienia

Stan na 2026-10-04 (branch `feature/mcp-connector`). Kod jest skompilowany, zlintowany i
przetestowany dymnie (initialize, tools/list, wywołanie narzędzia bez bazy). **Nic nie było
uruchamiane przeciw prawdziwej bazie**, bo sesja nie miała klucza service role.

## 1. Do zrobienia przez Tomasza (bez tego connector nie ruszy)

- [ ] Uruchomić migracje w Supabase → SQL Editor: [`docs/add-package-size-to-products.sql`](../add-package-size-to-products.sql) oraz [`docs/add-dietary-rules-to-user-settings.sql`](../add-dietary-rules-to-user-settings.sql) (zasady osobiste domowników; plik jest na branchu optymalizacji/integracyjnym).
- [ ] Uzupełnić `.env.local` według [`.env.example`](../../.env.example): `SUPABASE_SERVICE_ROLE_KEY`, `MCP_ACCESS_TOKEN` (min. 16 znaków), `MCP_ACTING_USER_EMAIL`.
- [ ] Test lokalny: `npm run dev`, potem `node scripts/mcp-smoke.mjs --call get_household`. Oczekiwane: lista domowników z Twoim kontem jako `is_me: true`.
- [ ] Uruchomić analizę: `node scripts/analyze-recipes.mjs`, przejrzeć `docs/mcp/analysis-output.md` (plik jest w `.gitignore`).
- [ ] Wpisać wyniki analizy w [`src/lib/mcp/recipe-rules.ts`](../../src/lib/mcp/recipe-rules.ts) w miejsca `TODO(Tomasz)` (widełki kcal per slot i osoba, białko, typowe gramatury) i podbić `RECIPE_RULES_VERSION`.
- [ ] Uzupełnić wielkości opakowań w zakładce Produkty (albo przez connector: "uzupełnij package_size dla produktów, które go nie mają, pytaj mnie o każdy").
- [ ] Deploy na Vercel z tymi samymi zmiennymi środowiskowymi, podłączenie w ChatGPT i/lub Claude według [`setup.md`](./setup.md).

## 2. Do przetestowania na prawdziwych danych (pierwsza sesja z connectorem)

Każde narzędzie zapisujące było pisane "w ciemno" na podstawie kodu UI. Kolejność testów:

- [ ] `get_household`, `list_products`, `list_meals`, `get_meal` – czy kcal per domownik zgadzają się z tym, co pokazuje aplikacja.
- [ ] `preview_meal_nutrition` – czy ostrzeżenia o opakowaniach mają sens przy realnych `package_size`.
- [ ] `create_meal` z `member_variants` – sprawdzić w aplikacji, że bazowy przepis i wariant domownika wyglądają jak dodane ręcznie (tagi, kategorie, nadpisania).
- [ ] `update_meal` – uwaga: `items` i `member_variants` ZASTĘPUJĄ całe listy (tak jak UI).
- [ ] `set_meal_plan_slot`, `plan_meals_bulk`, `copy_meal_plan_day` – czy planer pokazuje wpisy, czy kolumna `is_skipped` istnieje w bazie (typ `MealPlan` w `client.ts` jej nie ma, UI jej używa).
- [ ] `generate_shopping_list` – porównać wynik z przyciskiem "Generuj" w aplikacji dla tego samego zakresu i osób (ilości, grupowanie, porcje). Domyślnie czyści istniejącą listę.
- [ ] `set_shopping_list_meal_servings` – skalowanie ilości jak w UI.
- [ ] `delete_meal`, `delete_product`, `clear_shopping_list` – czy ChatGPT pyta o potwierdzenie (adnotacja `destructiveHint`).
- [ ] `search` / `fetch` – czy ChatGPT akceptuje format wyników w zwykłym trybie connectora (nie tylko w Developer mode).

## 3. Decyzje do potwierdzenia

- Tolerancja "czystego opakowania" = 0,02 opakowania (0,3 nie przechodzi, 0,26 przechodzi). Zmienić w `checkPackageUsage` w `src/lib/mcp/nutrition.ts` i w `CLEAN_TOLERANCE` w `scripts/analyze-recipes.mjs`.
- Dozwolone ułamki: 0,25 / 0,5 / 0,75 / 1 i wielokrotności całości. Jeśli 0,75 ma być zabronione, usunąć z `CLEAN_FRACTIONS`.
- Listy własne: connector widzi tylko listy widoczne dla acting usera (jak UI), nie wszystkie w gospodarstwie.
- `planned_kcal` w `get_meal_plan` pomija sloty oznaczone jako pominięte.
- Connector działa zawsze jako jedna osoba (acting user). Drugi domownik nie ma własnego connectora; jego dane są modyfikowane "w jego imieniu".

## 4. Ulepszenia na później

- **OAuth 2.1 przez Supabase Auth** zamiast tokenu w URL: connector działałby jako zalogowany użytkownik, RLS zadziałałoby naturalnie, każdy domownik mógłby mieć własne podłączenie. Wymaga endpointów discovery (`/.well-known/oauth-protected-resource`) i konfiguracji w Supabase.
- **Zasady w bazie zamiast w kodzie**: tabela `household_rules` edytowalna z poziomu aplikacji i connectora (`update_recipe_rules`), bez deployu przy każdej zmianie widełek.
- **Pole "na ile dni" na posiłku** (`servings_days`), żeby "gotuję na 2 dni" było daną, a nie tekstem w opisie; planer i lista zakupów mogłyby to uwzględniać automatycznie.
- **Współdzielenie warstwy danych z UI**: `src/lib/mcp/data.ts` i `nutrition.ts` ładują posiłki w 5 zapytaniach zamiast 4 na posiłek; frontend powinien używać tego samego kodu (patrz backlog optymalizacji w `docs/improvements.md` na branchu `chore/optimizations`).
- **Testy jednostkowe** czystych funkcji: `checkPackageUsage`, `describeItem`/`sumItems`, agregacja listy zakupów, `resolveMembers`.
- **Logowanie wywołań narzędzi** (kto, co, kiedy) do tabeli `mcp_audit_log`, przydatne przy "co ten GPT mi zmienił".
- **Limit zapytań / blokada** przy wielu błędnych tokenach pod rząd.
- **Obrazki posiłków**: `create_meal` nie obsługuje zdjęć (UI pozwala wgrać). Opcja: narzędzie przyjmujące URL obrazka.
- **Generowanie typów z bazy** (`supabase gen types`) i użycie ich w module MCP zamiast ręcznych rzutowań `as Type`.
- **Dokumentacja feature'a** w `docs/features/mcp-connector.md` po zatwierdzeniu działania (zgodnie z zasadami w globalnym CLAUDE.md).
