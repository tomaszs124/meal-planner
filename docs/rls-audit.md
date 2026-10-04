# Audyt RLS (Row Level Security)

Data: 2026-10-04 · gałąź `chore/optimizations` · zakres: `docs/*.sql` (33 pliki) + odczyty/zapisy w `src/`.
Dokument jest analizą statyczną — **nic nie zostało wykonane na bazie**. Wszystkie snippety SQL to propozycje.

Model docelowy: członek widzi i edytuje wszystko w swoim household; nikt nie widzi danych innego household;
`user_settings`, `body_measurements`, `daily_notes`, `bowel_movements` mogą być prywatne dla użytkownika.

---

## 1. Metoda

1. Przeczytano wszystkie 33 pliki i wypisano każde `CREATE POLICY` / `DROP POLICY` / `ENABLE ROW LEVEL SECURITY` oraz funkcje `SECURITY DEFINER`. Polityki zawiera 15 plików; pozostałe 18 to wyłącznie DDL kolumn/indeksów/realtime.
2. Kolejności nie da się odczytać z gita (brak dostępu do `git log` w tym zadaniu). Użyto: (a) komentarzy w plikach, które wprost odwołują się do poprzedników, (b) zależności DDL (plik B używa kolumny/tabeli z pliku A), (c) dat modyfikacji z systemu plików (`ls -l`) — te są **niewiarygodne** (np. `database-schema.sql` ma datę 21.02, a jest bazą).
3. Postgres łączy polityki *permissive* tej samej komendy przez **OR**, a `FOR ALL` bez `WITH CHECK` używa `USING` także jako warunku dla INSERT/UPDATE. Dlatego „stara” polityka, której nikt nie usunął, nadal poszerza dostęp — to kluczowe przy ocenie.
4. Weryfikacja z frontendem: `grep` po `.from('<table>')` w `src/` i analiza filtrów `user_id`.

**Gdzie kolejność jest pewna (z komentarzy / zależności):**
- `fix-rls-recursion.sql` → `fix-household-users-select-visibility.sql` (komentarz `fix-household-users-select-visibility.sql:2`).
- `add-meal-item-overrides.sql` → `fix-meal-item-overrides-household-access.sql` (`fix-meal-item-overrides-household-access.sql:10`).
- `add-tags-system.sql` → `enable-realtime-for-tags.sql` (`enable-realtime-for-tags.sql:5`).
- `user-settings-schema.sql` → `add-meal-categories-settings.sql` → `add-user-settings-trigger.sql` (trigger wstawia kolumny z `add-meal-categories-settings.sql:8-10`).
- `add-shopping-list-state-table.sql` → `add-shopping-list-meal-servings.sql`; `add-product-category.sql` → `add-editable-product-categories.sql`.

**Gdzie kolejność zgadywano:** `add-tags-system.sql` vs `allow-household-manage-meals.sql` (dla `meal_images` wynik jest ten sam w obu kolejnościach) oraz czy `meal-plans-schema.sql` w ogóle został skutecznie wykonany (patrz `meal_plan`).

**Dryf repo vs baza (ważne):**
- `database-schema.sql` to hybryda: zawiera już zmiany z późniejszych plików (`meals.user_id ... ON DELETE SET NULL` w `database-schema.sql:78` = `keep-meals-when-user-is-deleted.sql:15-19`; `meals.description` w `database-schema.sql:81` = `add-tags-system.sql:6-7`), ale ma stare polityki `meals` (`database-schema.sql:397-402`).
- Kolumna `meal_plan.is_skipped` używana przez UI (`src/components/MealPlanner/MealPlanner.tsx:494`, typ `src/lib/supabase/client.ts:111`) **nie występuje w żadnym pliku SQL** → repo nie odtwarza produkcji w 100%. Stan końcowy poniżej to najlepsza rekonstrukcja, nie pewnik.

**Funkcje pomocnicze:**
- `get_user_household_ids(user_uuid uuid)` — `database-schema.sql:313-321`: `plpgsql`, `SECURITY DEFINER`, **bez `SET search_path`**, przyjmuje *dowolny* UUID, domyślnie wykonywalna przez `PUBLIC` (w tym `anon`). Używana w niemal wszystkich politykach household.
- `user_has_meal_overrides(uuid, uuid)` — `add-meal-item-overrides.sql:102-114`: `SECURITY DEFINER`, `GRANT ... TO authenticated`; zwraca bool dla dowolnej pary meal/user (drobny wyciek; nieużywana w `src/`).
- `create_user_settings_on_signup()` — `add-user-settings-trigger.sql:4-25`: trigger na `auth.users`, **bez `SECURITY DEFINER`**.

---

## 2. Tabela po tabeli

Skróty: **HH** = `household_id IN (SELECT get_user_household_ids(auth.uid()))`; **HH(meal)** = `meal_id IN (SELECT id FROM meals WHERE HH)`.

### profiles — `ZA LUŹNE`
- SELECT: `USING (true)` bez `TO` → **każdy, także `anon`**, czyta wszystkie profile (`database-schema.sql:328-330`).
- INSERT/UPDATE: tylko własny wiersz (`:332-338`). DELETE: brak.
- Frontend czyta tylko profile członków household (`src/components/Meals/Meals.tsx:392-394`, `src/components/ShoppingList/ShoppingListEnhanced.tsx:305-307`), więc zawężenie niczego nie zepsuje. Ujawnia listę `id` użytkowników → problem #1.

### households — `OK` (z uwagą)
SELECT: `id` ∈ HH (`database-schema.sql:341-345`). INSERT: `created_by = auth.uid()` (`:347-349`) — każdy zalogowany może utworzyć household (UI tego nie robi). UPDATE: owner (`:351-358`). DELETE: brak.

### household_users — `ZA LUŹNE` (krytyczne)
Historia:
- `database-schema.sql:361-374`: SELECT = HH; `FOR ALL` dla ownera z podzapytaniem do samej tabeli → rekurencja.
- `fix-rls-recursion.sql:6-34`: drop obu; SELECT = `user_id = auth.uid()` (`:10-12`); **INSERT `WITH CHECK (user_id = auth.uid())`** (`:14-16`); UPDATE/DELETE dla ownera (`:18-34`).
- `fix-household-users-select-visibility.sql:5-13`: SELECT ponownie = HH (przez funkcję `SECURITY DEFINER`, więc bez rekurencji).

Stan końcowy: SELECT = HH; **INSERT = wolno wstawić siebie do dowolnego household z dowolną rolą (także `owner`)**; UPDATE/DELETE = owner household.
Gdyby kolejność obu „fixów” była odwrotna, SELECT wróciłby do „tylko mój wiersz” i lista domowników (`src/components/MealPlanner/MealPlanner.tsx:159-161`, `src/components/ShoppingList/CustomLists.tsx:68-70`) zwracałaby tylko mnie.
Frontend **nigdy nie robi INSERT** do `household_users` (tylko SELECT), więc polityka INSERT jest zbędna.

### products — `OK`
SELECT + `FOR ALL` = HH (`database-schema.sql:377-387`). SELECT redundantny.

### product_categories — `OK`
SELECT = HH, `FOR ALL` = HH z `WITH CHECK` (`add-editable-product-categories.sql:77-92`).

### meals — `OK` (kolumna `is_shared` martwa)
- SELECT: HH `AND (is_shared OR user_id = auth.uid())` (`database-schema.sql:390-395`).
- „Users can manage own meals” (tylko autor, `database-schema.sql:397-402`) zastąpiona przez „Users can manage household meals” `FOR ALL` = HH (`allow-household-manage-meals.sql:6-14`).
- Efekt: `FOR ALL` obejmuje też SELECT, więc OR = **wszystkie posiłki household widoczne niezależnie od `is_shared`**. Zgodne z modelem, ale `is_shared` niczego nie chroni. INSERT nie wymusza `user_id = auth.uid()` (w modelu OK).

### meal_items — `OK`
SELECT = HH(meal) (`database-schema.sql:405-412`); manage: z „tylko autor posiłku” (`:414-421`) na HH(meal) z `WITH CHECK` (`allow-household-manage-meals.sql:17-31`). Brak sprawdzenia, że `product_id` jest z tego samego household (niskie, #8).

### meal_item_overrides — `OK` (pozostałe „śmieciowe” polityki)
- `add-meal-item-overrides.sql:41-78`: SELECT/INSERT przez join `meals`+`household_users`; UPDATE „Users can update **their own meal item** overrides” i DELETE „Users can delete **their own meal item** overrides” (tylko własne).
- `fix-meal-item-overrides-household-access.sql:11-14` usuwa SELECT i INSERT, ale DROP dla UPDATE/DELETE ma **inne nazwy** („Users can update their own overrides”, „Users can delete their own overrides”) → stare UPDATE/DELETE **nadal istnieją**. Nowe (`:17-86`): SELECT/UPDATE/DELETE = posiłek w HH; INSERT/UPDATE `WITH CHECK` dodatkowo: `user_id` jest członkiem mojego household.
- Efekt (OR): dostęp household-wide — tego wymaga UI: odczyt cudzych wariantów `src/components/Meals/Meals.tsx:853-856`, kasowanie wariantów całego posiłku `:942`, insert dla innych `user_id` `:944-961`, lista zakupów `src/components/ShoppingList/ShoppingListEnhanced.tsx:457`. Problem tylko porządkowy (#6).

### meal_images — `OK`
- `database-schema.sql:424-440`: SELECT = HH(meal), manage = autor posiłku.
- `add-tags-system.sql:111-152`: drop obu, oba odtworzone jako HH(meal).
- `allow-household-manage-meals.sql:34-48`: drop „Users can manage meal images”, nowa „Users can manage household meal images” = HH(meal) z `WITH CHECK`.
- Niezależnie od kolejności wynik = HH(meal) (ewentualnie dwie równoważne polityki `FOR ALL`).

### tags — `OK`
SELECT + `FOR ALL` = HH (`add-tags-system.sql:46-56`).

### meal_tags — `OK`
SELECT + `FOR ALL` = HH(meal) (`add-tags-system.sql:88-104`). `tag_id` nie jest sprawdzany względem household (niskie, #8).

### meal_plan — `NIEJASNE` (najpewniej `OK`)
Dwie sprzeczne wersje:

| Plik | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `database-schema.sql:443-453` | HH | HH (`FOR ALL`) | HH | HH |
| `meal-plans-schema.sql:22-43` | `auth.uid() = user_id` | own | own | own |

- Nazwy polityk są różne, więc jeśli wykonano oba pliki, działa OR → **HH** (stan, którego wymaga UI).
- `meal-plans-schema.sql:2` ma `CREATE TABLE IF NOT EXISTS` (no-op przy istniejącej tabeli), a `:50-53` tworzy trigger na `public.set_updated_at()` — **ta funkcja nie jest zdefiniowana w żadnym pliku**, a kolumny `updated_at` nie ma w wersji z `database-schema.sql:125-134`. Uruchomiony jako jeden batch w SQL Editorze plik najpewniej wycofał się w całości. Treść (`second_breakfast`, `is_consumed`) wygląda na późniejszy „opis” stanu po `fix-meal-plan-constraint.sql` i `add-is-consumed-to-meal-plan.sql`.
- **Gdyby w bazie były tylko polityki „own”, byłoby `ZA CIASNE`** — zepsułyby się: kopiowanie dnia domownika `src/components/MealPlanner/MealPlanner.tsx:393-397`, wysyłanie dnia domownikowi (SELECT/DELETE/INSERT z cudzym `user_id`) `:497-516`, lista zakupów dla wybranych członków `src/components/ShoppingList/ShoppingListEnhanced.tsx:434-437`. Skoro te funkcje działają, polityki HH istnieją.
- `WITH CHECK` nie wymusza, że `user_id` jest członkiem household ani że `meal_id` należy do household (niskie, #4).

### consumed_meals — `OK`
SELECT + `FOR ALL` = `user_id = auth.uid()` (`database-schema.sql:456-462`). Nieużywana w `src/`.

### shopping_list_items — `OK`
SELECT + `FOR ALL` = HH (`database-schema.sql:465-475`). Realtime: `database-schema.sql:509`, `ensure-realtime-shopping-list-items.sql:4-18` (Realtime respektuje RLS). `product_id`/`meal_id`/`source_user_id` nie są sprawdzane względem household (niskie).

### shopping_list_state — `OK`
SELECT + `FOR ALL` = HH (`add-shopping-list-state-table.sql:21-33`).

### custom_lists — `ZA LUŹNE` (względem `visible_to`)
`FOR ALL` = `household_id IN (SELECT household_id FROM household_users WHERE user_id = auth.uid())` (`add-custom-lists.sql:25-30`). Kolumna `visible_to` (`:7`) jest filtrowana **tylko w UI** (`src/components/ShoppingList/CustomLists.tsx:220`); przez API domownik widzi i edytuje każdą listę household. Jeśli `visible_to` to preferencja widoku — OK; jeśli prywatność — za luźne.

### custom_list_items — `OK`
`FOR ALL` = lista należy do mojego household (`add-custom-lists.sql:32-39`). Dziedziczy uwagę o `visible_to`.

### user_settings — `OK` (trigger `NIEJASNE`)
- SELECT: own (`user-settings-schema.sql:36-39`) → zastąpiona przez „own **lub** użytkownik z mojego household” (`fix-user-settings-household-visibility.sql:4-19`). Potrzebne: `src/components/Meals/Meals.tsx:396-398`, `src/components/ShoppingList/CustomLists.tsx:74-75`, `src/components/ShoppingList/ShoppingListEnhanced.tsx:309-311`.
- INSERT/UPDATE/DELETE: own (`user-settings-schema.sql:42-58`). Domownik widzi wszystkie kolumny ustawień (zgodne z modelem).
- Trigger `add-user-settings-trigger.sql:4-34` nie jest `SECURITY DEFINER`: działa jako `supabase_auth_admin`, gdzie `auth.uid()` = NULL, więc INSERT nie przejdzie polityki `user-settings-schema.sql:42-45` (o ile w ogóle są uprawnienia) → rejestracja może kończyć się „Database error saving new user”. Fallback w UI: `src/components/MealPlanner/MealPlanner.tsx:84-95`.

### body_measurements / daily_notes / bowel_movements — `OK`
SELECT + `FOR ALL` = `user_id = auth.uid()` (`database-schema.sql:478-502`). Prywatne; nieużywane w `src/`.

### storage: bucket `meal-images` — `ZA LUŹNE`
- Bucket `public = true` (`create-meal-images-storage.sql:6-14`) → plik dostępny **bez logowania** dla każdego, kto zna URL; polityka SELECT (`:34-44`) dotyczy tylko API (list/download), nie publicznego endpointu.
- INSERT/SELECT/UPDATE/DELETE: pierwszy segment ścieżki ∈ moje `household_id` (`:21-70`). Ścieżka w UI: `${household.id}/${mealId}/${fileName}` (`src/components/Meals/Meals.tsx:650`), URL przez `getPublicUrl` (`:668`).
- Polityki bez `DROP POLICY IF EXISTS` → plik nie jest idempotentny.

---

## 3. Znalezione problemy (od najpoważniejszego)

### #1 KRYTYCZNE — przejęcie dowolnego household przez INSERT do `household_users`
Łańcuch: (a) `profiles` czytelne dla `anon` (`database-schema.sql:328-330`) → lista `user_id`; (b) `rpc('get_user_household_ids', { user_uuid })` z cudzym UUID zwraca jego household (`database-schema.sql:313-321`); (c) `INSERT INTO household_users (household_id, user_id, role) VALUES (<cudzy>, auth.uid(), 'owner')` przechodzi (`fix-rls-recursion.sql:14-16`); (d) atakujący ma pełny dostęp do danych household, a jako owner może usunąć prawowitych członków (`fix-rls-recursion.sql:27-34`). Wymaga konta — UI nie ma `signUp`, ale endpoint `/auth/v1/signup` z kluczem anon jest domyślnie otwarty (sprawdzić: Dashboard → Auth → „Allow new users to sign up”).

```sql
-- UI nigdy nie dodaje członków; household zakładamy ręcznie / przez RPC admina
DROP POLICY IF EXISTS "Users can insert household memberships" ON public.household_users;
-- (opcjonalnie) tylko owner dodaje członków:
CREATE POLICY "Household owners can add members"
    ON public.household_users FOR INSERT TO authenticated
    WITH CHECK (household_id IN (
        SELECT hu.household_id FROM public.household_users hu
        WHERE hu.user_id = auth.uid() AND hu.role = 'owner'));
```

### #2 WYSOKIE — `get_user_household_ids` ujawnia household dowolnego użytkownika
Plus brak `SET search_path` w funkcji `SECURITY DEFINER`. Sygnatura zostaje (używana w ~25 politykach), dochodzi strażnik `user_uuid = auth.uid()`:

```sql
CREATE OR REPLACE FUNCTION public.get_user_household_ids(user_uuid uuid)
RETURNS TABLE(household_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT hu.household_id FROM public.household_users hu
    WHERE hu.user_id = user_uuid AND user_uuid = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_household_ids(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_household_ids(uuid) TO authenticated;
-- Po REVOKE zapytania anon do tabel z politykami HH zwrócą błąd uprawnień zamiast pustej listy;
-- czyściej: dodać TO authenticated do polityk (#9).
REVOKE EXECUTE ON FUNCTION public.user_has_meal_overrides(uuid, uuid) FROM PUBLIC, anon, authenticated; -- nieużywana
```

### #3 WYSOKIE — `profiles` czytelne dla wszystkich (także niezalogowanych)
```sql
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view household profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR id IN (
        SELECT hu.user_id FROM public.household_users hu
        WHERE hu.household_id IN (SELECT get_user_household_ids(auth.uid()))));
```

### #4 ŚREDNIE — `meal_plan`: dwa zestawy polityk, stan zależy od historii
Ujednolicić jawnie (idempotentnie) i dodać sprawdzenie członkostwa `user_id` oraz household posiłku:
```sql
DROP POLICY IF EXISTS "Users can view own meal plans"   ON public.meal_plan;
DROP POLICY IF EXISTS "Users can insert own meal plans" ON public.meal_plan;
DROP POLICY IF EXISTS "Users can update own meal plans" ON public.meal_plan;
DROP POLICY IF EXISTS "Users can delete own meal plans" ON public.meal_plan;
DROP POLICY IF EXISTS "Users can view household meal plans"   ON public.meal_plan;
DROP POLICY IF EXISTS "Users can manage household meal plans" ON public.meal_plan;
CREATE POLICY "Users can view household meal plans"
    ON public.meal_plan FOR SELECT TO authenticated
    USING (household_id IN (SELECT get_user_household_ids(auth.uid())));
CREATE POLICY "Users can manage household meal plans"
    ON public.meal_plan FOR ALL TO authenticated
    USING (household_id IN (SELECT get_user_household_ids(auth.uid())))
    WITH CHECK (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
        AND EXISTS (SELECT 1 FROM public.household_users hu
                    WHERE hu.household_id = meal_plan.household_id AND hu.user_id = meal_plan.user_id)
        AND EXISTS (SELECT 1 FROM public.meals m
                    WHERE m.id = meal_plan.meal_id AND m.household_id = meal_plan.household_id));
```

### #5 ŚREDNIE — publiczny bucket `meal-images`
Zdjęcia dostępne bez logowania po URL. Opcja A: świadoma akceptacja (zdjęcia potraw, losowe nazwy). Opcja B (wymaga zmian w `src/components/Meals/Meals.tsx:668` i trzymania ścieżki zamiast URL → `createSignedUrl`):
```sql
UPDATE storage.buckets SET public = false WHERE id = 'meal-images';
-- niezależnie od opcji — idempotencja polityk storage w migracji:
DROP POLICY IF EXISTS "Users can upload meal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view meal images"   ON storage.objects;
DROP POLICY IF EXISTS "Users can delete meal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update meal images" ON storage.objects;
-- ...a potem CREATE POLICY jak w create-meal-images-storage.sql:21-70
```

### #6 NISKIE — zapomniane polityki UPDATE/DELETE w `meal_item_overrides`
```sql
DROP POLICY IF EXISTS "Users can update their own meal item overrides" ON public.meal_item_overrides;
DROP POLICY IF EXISTS "Users can delete their own meal item overrides" ON public.meal_item_overrides;
```

### #7 NISKIE — `custom_lists.visible_to` nie jest egzekwowane w RLS
Jeśli ma oznaczać prywatność:
```sql
DROP POLICY IF EXISTS "custom_lists_household_access" ON public.custom_lists;
CREATE POLICY "custom_lists_household_access" ON public.custom_lists
    FOR ALL TO authenticated
    USING (household_id IN (SELECT get_user_household_ids(auth.uid()))
           AND (created_by = auth.uid() OR auth.uid() = ANY (visible_to)))
    WITH CHECK (household_id IN (SELECT get_user_household_ids(auth.uid())));
```
`custom_list_items` dziedziczy to automatycznie (jej podzapytanie do `custom_lists` podlega RLS).

### #8 NISKIE — referencje między household nie są sprawdzane
`meal_items.product_id`, `meal_item_overrides.product_id`, `meal_tags.tag_id`, `shopping_list_items.product_id/meal_id` — FK sprawdzane są z pominięciem RLS, więc znając UUID można podpiąć cudzy wiersz (problem integralności, nie wyciek — `products`/`tags` dalej ukryte). Wzór:
```sql
DROP POLICY IF EXISTS "Users can manage meal tags" ON public.meal_tags;
CREATE POLICY "Users can manage meal tags" ON public.meal_tags FOR ALL TO authenticated
    USING (meal_id IN (SELECT id FROM public.meals WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))))
    WITH CHECK (
        meal_id IN (SELECT id FROM public.meals WHERE household_id IN (SELECT get_user_household_ids(auth.uid())))
        AND tag_id IN (SELECT id FROM public.tags WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))));
```

### #9 NISKIE — higiena polityk
Brak `TO authenticated` (polityki obejmują też `anon`); brak `WITH CHECK` w wielu `FOR ALL` (działa przez `USING`, ale mniej czytelne); `auth.uid()` liczone per wiersz — Supabase zaleca `(select auth.uid())`. Polityka INSERT na `households` (`database-schema.sql:347-349`) do usunięcia — UI nie tworzy household. `meals.is_shared`: usunąć kolumnę albo egzekwować.

### #10 FUNKCJONALNE — trigger `create_user_settings_on_signup`
```sql
CREATE OR REPLACE FUNCTION public.create_user_settings_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.user_settings (user_id, snack_enabled, second_breakfast_enabled, lunch_enabled, dinner_enabled)
    VALUES (NEW.id, false, true, true, true)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END $$;
```
Poza RLS: `src/app/debug/page.tsx:30-45` wyświetla `households`/`household_users` — RLS je ogranicza, ale stronę warto usunąć z produkcji.

---

## 4. Testy do napisania

Środowisko: lokalny Supabase (`supabase start`) + seed: household H1 (A = owner, B = member), household H2 (C = owner); każdy ma meals, products, tags, meal_plan, overrides, custom lists, ustawienia, pomiary, plik w `meal-images/H2/...`. Testy w pgTAP (`supabase test db`) lub supabase-js z JWT każdego użytkownika.

**Izolacja household (A vs H2):**
- [ ] A nie widzi (SELECT = 0 wierszy) wierszy H2 w: `households`, `household_users`, `products`, `product_categories`, `meals`, `meal_items`, `meal_item_overrides`, `meal_images`, `tags`, `meal_tags`, `meal_plan`, `shopping_list_items`, `shopping_list_state`, `custom_lists`, `custom_list_items`.
- [ ] A nie może INSERT do żadnej z tych tabel z `household_id = H2` (lub `meal_id`/`list_id` z H2).
- [ ] A nie może UPDATE/DELETE wierszy H2 (0 zmienionych wierszy).
- [ ] A nie może UPDATE własnego wiersza tak, by przenieść go do H2 (`SET household_id = H2`).
- [ ] A nie może dodać do `meal_tags` tagu z H2 ani do `meal_items` produktu z H2 (po fixie #8).
- [ ] A nie może wstawić `meal_plan` z `user_id = C` ani z `meal_id` z H2 (po fixie #4).

**Członkostwo i funkcje (fix #1, #2, #3):**
- [ ] A nie może `INSERT INTO household_users (H2, A, 'owner')` ani `(H2, A, 'member')`.
- [ ] B (member) nie może zmienić swojej roli na `owner` ani usunąć A.
- [ ] A (owner H1) nie może usunąć ani zmienić C w H2.
- [ ] `rpc('get_user_household_ids', { user_uuid: C })` wywołane przez A zwraca pusty wynik; przez `anon` — błąd lub pusto.
- [ ] `anon` nie widzi żadnego wiersza `profiles`; A widzi tylko profile A i B.
- [ ] `anon` nie widzi żadnego wiersza w żadnej tabeli schematu `public`.

**Współdzielenie wewnątrz household (regresje — muszą przechodzić):**
- [ ] B czyta i nadpisuje `meal_plan` A (kopiowanie/wysyłanie dnia, `MealPlanner.tsx:393-397`, `:497-516`).
- [ ] B czyta `meal_plan` A w zakresie dat (lista zakupów, `ShoppingListEnhanced.tsx:434-437`).
- [ ] B tworzy i kasuje `meal_item_overrides` z `user_id = A` (`Meals.tsx:942-961`).
- [ ] B widzi `user_settings.name` A; B nie może UPDATE/DELETE `user_settings` A.
- [ ] B widzi wszystkich członków H1 w `household_users`.
- [ ] B edytuje i usuwa meals/meal_items/meal_images utworzone przez A.

**Dane prywatne:**
- [ ] B nie widzi `body_measurements`, `daily_notes`, `bowel_movements`, `consumed_meals` A (ten sam household!).
- [ ] B nie może INSERT do tych tabel z `user_id = A`.
- [ ] (jeśli fix #7) B nie widzi listy `custom_lists` z `created_by = A`, gdy `visible_to` nie zawiera B.

**Storage:**
- [ ] A nie może `upload` do `meal-images/H2/...`; `list('H2')` zwraca pusto; `remove(['H2/...'])` niczego nie usuwa.
- [ ] A nie może `move` pliku z `H1/...` do `H2/...`.
- [ ] (jeśli fix #5) GET URL obiektu bez tokena zwraca błąd.

**Realtime:**
- [ ] Subskrypcja A na `shopping_list_items` / `custom_lists` / `tags` nie dostaje zdarzeń z H2.

---

## 5. Rekomendacja: migracja do Supabase CLI

**Preferowane:** baseline z produkcji, a nie sklejanie plików — repo nie odtwarza bazy (brak `meal_plan.is_skipped`, niepewny los `meal-plans-schema.sql`). `supabase db pull` (lub `supabase db dump`) → `supabase/migrations/<ts>_baseline.sql`, potem osobna migracja `<ts>_rls_hardening.sql` z poprawkami #1–#10. Przed tym zrzucić `SELECT schemaname, tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname IN ('public','storage')` i porównać z rekonstrukcją z sekcji 2 — to rozstrzygnie punkty `NIEJASNE`.

**Zapasowo (sklejenie istniejących plików w jedną migrację początkową)** — kolejność wg zależności i dat:

1. `database-schema.sql` (baza; już zawiera zmiany z pkt 9 i 30 — tamte pliki są idempotentne)
2. `fix-rls-recursion.sql`
3. `add-macronutrients.sql`
4. `user-settings-schema.sql`
5. `add-meal-categories.sql`
6. `fix-meal-plan-constraint.sql`
7. `add-is-consumed-to-meal-plan.sql`
8. ~~`meal-plans-schema.sql`~~ — **pominąć** (sprzeczne polityki, trigger na nieistniejącą funkcję; zastępuje go fix #4)
9. `add-tags-system.sql`
10. `enable-realtime-for-tags.sql`
11. `add-product-category.sql`
12. `add-meal-item-overrides.sql`
13. `create-meal-images-storage.sql`
14. `remove-calorie-goals.sql`
15. `add-name-to-user-settings.sql`
16. `add-meal-categories-settings.sql`
17. `add-user-settings-trigger.sql` (po 16; z poprawką #10)
18. `add-custom-amount-text.sql`
19. `add-meal-id-to-shopping-list.sql`
20. `add-shopping-list-source-user-id.sql`
21. `add-unit-weight-to-products.sql`
22. `add-shopping-list-state-table.sql`
23. `add-shopping-list-meal-servings.sql` (po 22)
24. `ensure-realtime-shopping-list-items.sql`
25. `fix-household-users-select-visibility.sql` (musi być po 2)
26. `fix-user-settings-household-visibility.sql` (po 4)
27. `add-editable-product-categories.sql` (po 11)
28. `allow-household-manage-meals.sql`
29. `fix-meal-item-overrides-household-access.sql` (po 12)
30. `keep-meals-when-user-is-deleted.sql`
31. `add-leaf-cube-slice-units.sql`
32. `add-custom-lists.sql`
33. `add-notes-to-products.sql`
34. **nowa** migracja `rls_hardening`: poprawki #1–#10 + `ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS is_skipped boolean NOT NULL DEFAULT false` (typ i default sprawdzić w produkcji).

Po migracji: przenieść `docs/*.sql` do `docs/legacy-sql/` (lub usunąć), a testy z sekcji 4 podpiąć do CI (`supabase test db`).
