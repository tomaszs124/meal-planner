# Konektor MCP: uruchomienie i podłączenie do ChatGPT / Claude

Konektor MCP pozwala ChatGPT i Claude tworzyć przepisy, układać plan posiłków i generować listę zakupów bezpośrednio w bazie Meal Plannera. Ten plik to instrukcja krok po kroku: od zmiennych środowiskowych, przez test lokalny, po deploy i podłączenie w aplikacjach czatu.

## Checklista: co musi uzupełnić Tomasz

- [ ] **Zmienne środowiskowe** w `.env.local` (lokalnie) i w Vercel (produkcja): `SUPABASE_SERVICE_ROLE_KEY`, `MCP_ACCESS_TOKEN`, `MCP_ACTING_USER_EMAIL` (albo `MCP_ACTING_USER_ID`), opcjonalnie `NEXT_PUBLIC_APP_URL`. Wzór: [`.env.example`](../../.env.example). → [krok 1](#1-zmienne-środowiskowe)
- [ ] **Migracja bazy**: uruchom [`docs/add-package-size-to-products.sql`](../add-package-size-to-products.sql) w Supabase Dashboard → SQL Editor (dodaje kolumnę `products.package_size`).
- [ ] **Wielkości opakowań**: w zakładce Produkty uzupełnij wielkość opakowania dla produktów kupowanych w paczkach (raport z analizy podpowie, od których zacząć). Albo poproś o to asystenta przez konektor (patrz [przykładowe polecenia](#7-przykładowe-polecenia)).
- [ ] **Analiza przepisów**: `node scripts/analyze-recipes.mjs` → [krok 8](#8-analiza-i-uzupełnienie-zasad)
- [ ] **Zasady**: wpisz widełki kalorii, białko i typowe ilości w [`src/lib/mcp/recipe-rules.ts`](../../src/lib/mcp/recipe-rules.ts) w miejsce `TODO(Tomasz)` i podbij `RECIPE_RULES_VERSION`.
- [ ] **Deploy** na Vercel ze zmiennymi środowiskowymi → [krok 4](#4-deploy-produkcyjny-vercel)
- [ ] **Podłączenie** konektora w ChatGPT i/lub Claude → [krok 5](#5-podłączenie-do-chatgpt), [krok 6](#6-podłączenie-do-claude)

## Jak to działa w skrócie

- Endpoint: `POST /api/mcp/<MCP_ACCESS_TOKEN>` ([`src/app/api/mcp/[token]/route.ts`](../../src/app/api/mcp/%5Btoken%5D/route.ts)). Transport MCP „Streamable HTTP”, bezstanowy (bez sesji), odpowiedzi w zwykłym JSON (bez SSE), runtime Node, `maxDuration = 60` s.
- Zamiast tokenu w ścieżce można wysłać nagłówek `Authorization: Bearer <MCP_ACCESS_TOKEN>` (wtedy ostatni segment ścieżki może być dowolny). ChatGPT nie pozwala ustawić własnych nagłówków, dlatego token jest w URL.
- Serwer łączy się z Supabase kluczem **service role** i działa w imieniu jednej osoby („acting user”, z `MCP_ACTING_USER_EMAIL` / `MCP_ACTING_USER_ID`). Wszystkie zapytania są zawężone do gospodarstwa tej osoby ([`src/lib/mcp/context.ts`](../../src/lib/mcp/context.ts)).
- Narzędzia: domownicy i zasady (`get_household`, `get_recipe_rules`), posiłki (`list_meals`, `get_meal`, `preview_meal_nutrition`, `create_meal`, `update_meal`, `delete_meal`), tagi (`list_tags`, `create_tag`), plan (`get_meal_plan`, `set_meal_plan_slot`, `plan_meals_bulk`, `clear_meal_plan_slot`, `set_meal_plan_status`, `copy_meal_plan_day`), produkty (`list_products`, `list_product_categories`, `create_product`, `update_product`, `delete_product`), zakupy (`get_shopping_list`, `generate_shopping_list`, `add_shopping_list_item`, …, listy własne) oraz `search` i `fetch`.
- Zasady tworzenia przepisów (opakowania na 2 osoby, kalorie, jednostki) są w [`src/lib/mcp/recipe-rules.ts`](../../src/lib/mcp/recipe-rules.ts) i trafiają do asystenta przez `get_recipe_rules`.

## 1. Zmienne środowiskowe

Istniejące publiczne zmienne aplikacji zostają bez zmian: `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Dochodzą nowe (pełna lista z komentarzami: [`.env.example`](../../.env.example)):

| Zmienna | Skąd wziąć | Uwagi |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API (sekcja kluczy, klucz **service_role** / „secret”) | **Tylko serwer.** Omija RLS. Nigdy nie dodawaj prefiksu `NEXT_PUBLIC_`, nie importuj w komponentach klienckich, nie wklejaj do czatu. |
| `MCP_ACCESS_TOKEN` | wygeneruj: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | Minimum 16 znaków (krótszy token = serwer odrzuca wszystko). To jedyne zabezpieczenie endpointu. |
| `MCP_ACTING_USER_EMAIL` | Twój e-mail logowania do aplikacji | Serwer znajduje po nim użytkownika w Supabase Auth. |
| `MCP_ACTING_USER_ID` | Supabase Dashboard → Authentication → Users → kliknij użytkownika → **User UID** | Alternatywa dla e-maila (ma pierwszeństwo, jeśli ustawione oba). Oszczędza jedno zapytanie do Auth. |
| `NEXT_PUBLIC_APP_URL` (opcjonalnie) | np. `https://meal-planner.vercel.app` | Bazowy adres do linków zwracanych przez `search` / `fetch`. Domyślnie `http://localhost:3000`. |

Lokalnie wpisz je do `.env.local` (plik jest w `.gitignore`). Po zmianie `.env.local` zrestartuj `npm run dev`.

## 2. Uruchomienie lokalne

```bash
npm run dev
```

Endpoint: `http://localhost:3000/api/mcp/<MCP_ACCESS_TOKEN>`

### Smoke test curl (Git Bash)

```bash
TOKEN=...   # wartość MCP_ACCESS_TOKEN
URL="http://localhost:3000/api/mcp/$TOKEN"

# 1) initialize
curl -s "$URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0.0.1"}}}'

# 2) lista narzędzi
curl -s "$URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3) wywołanie narzędzia (tylko odczyt)
curl -s "$URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_household","arguments":{}}}'
```

Wariant z nagłówkiem zamiast tokenu w ścieżce: `curl -s http://localhost:3000/api/mcp/x -H "Authorization: Bearer $TOKEN" ...`.

W PowerShell użyj `curl.exe` (samo `curl` to alias `Invoke-WebRequest`) albo:

```powershell
$url = "http://localhost:3000/api/mcp/$env:MCP_ACCESS_TOKEN"
$headers = @{ Accept = 'application/json, text/event-stream' }
$body = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 10
```

Czego się spodziewać:
- `initialize` zwraca `result.serverInfo` i `result.capabilities.tools`.
- `tools/list` zwraca listę narzędzi z sekcji „Jak to działa”.
- `401 Unauthorized` = zły token albo brak/za krótki `MCP_ACCESS_TOKEN` w env.
- Przekierowanie na `/login` = endpoint wpadł w middleware autoryzacji (patrz [krok 4](#4-deploy-produkcyjny-vercel)).
- Błąd `MCP: set MCP_ACTING_USER_ID or MCP_ACTING_USER_EMAIL` / `missing ... SUPABASE_SERVICE_ROLE_KEY` w wyniku narzędzia = brak zmiennej środowiskowej.

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

W oknie przeglądarki: Transport Type **Streamable HTTP**, URL `http://localhost:3000/api/mcp/<MCP_ACCESS_TOKEN>` → Connect → zakładka Tools → List Tools. Można stąd wywołać każde narzędzie z formularza (dobre do sprawdzenia `preview_meal_nutrition` przed testem w czacie).

## 3. Wystawienie na świat do testów

ChatGPT i claude.ai łączą się z serwerem z internetu, więc `localhost` nie wystarczy. Do szybkich testów bez deployu:

```bash
npx cloudflared tunnel --url http://localhost:3000
# albo
ngrok http 3000
```

Tunel wypisze adres typu `https://xyz.trycloudflare.com`. Adres konektora: `https://xyz.trycloudflare.com/api/mcp/<MCP_ACCESS_TOKEN>`.

> **Uwaga:** token w URL to jedyne zabezpieczenie. Kto zna pełny adres, może czytać i zmieniać dane gospodarstwa (z uprawnieniami service role). Traktuj URL jak hasło: nie wklejaj go do publicznych miejsc, nie commituj, zamknij tunel po testach. W razie wycieku zmień token ([krok 9](#9-bezpieczeństwo-i-ograniczenia)).

## 4. Deploy produkcyjny (Vercel)

1. Vercel → Add New → Project → Import z GitHuba repozytorium `tomaszs124/meal-planner` (framework wykryje się jako Next.js).
2. Project Settings → Environment Variables: dodaj `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MCP_ACCESS_TOKEN`, `MCP_ACTING_USER_EMAIL` (lub `MCP_ACTING_USER_ID`), `NEXT_PUBLIC_APP_URL` (adres produkcyjny). Zaznacz środowisko **Production** (i Preview, jeśli chcesz testować na preview).
3. Deploy (albo Redeploy po zmianie zmiennych: zmiany env nie działają wstecz na istniejące buildy).
4. Route MCP działa na runtime **Node** (`export const runtime = 'nodejs'`) i ma `maxDuration = 60` s. Na planie Hobby 60 s to rozsądny limit; dłuższe operacje (np. duży `plan_meals_bulk`) dziel na mniejsze.
5. Middleware autoryzacji ([`src/middleware.ts`](../../src/middleware.ts)) **musi pomijać** `/api/mcp` (inaczej konektor dostanie przekierowanie na `/login`). Jest to już zrobione w `matcher` (wykluczenie `api/mcp`); pilnuj tego przy zmianach middleware.
6. Sprawdź curl-em z [kroku 2](#2-uruchomienie-lokalne), podmieniając host na produkcyjny.

## 5. Podłączenie do ChatGPT

Wymaga planu Plus / Pro / Business / Enterprise (tryb deweloperski).

1. ChatGPT → Settings → **Apps & Connectors** (w starszych wersjach: **Connectors**).
2. **Advanced settings** → włącz **Developer mode**.
3. Wróć do listy i kliknij **Create** (Create connector):
   - Name: `Meal Planner`
   - Description: np. „Przepisy, plan posiłków i lista zakupów naszego domu”
   - MCP server URL: `https://<host>/api/mcp/<MCP_ACCESS_TOKEN>`
   - Authentication: **No authentication**
   - zaznacz, że ufasz aplikacji → **Create**.
4. Po utworzeniu ChatGPT pokaże listę wykrytych narzędzi (powinno ich być ok. 30). Jeśli lista jest pusta, sprawdź URL curl-em.
5. W nowym czacie: **+** → **More** → **Developer mode** → wybierz konektor **Meal Planner**.

Jak to wygląda w użyciu:
- Narzędzia zapisujące (tworzenie przepisu, zmiana planu, generowanie listy zakupów) ChatGPT pokazuje do **potwierdzenia** przed wykonaniem. Możesz zatwierdzać pojedynczo albo powiedzieć na początku rozmowy „zapisz od razu” / „nie pytaj o potwierdzenie” (zasady też to przewidują: asystent pokazuje podsumowanie i czeka na akceptację, chyba że powiesz „zapisz od razu”).
- Serwer udostępnia też narzędzia `search` i `fetch` w formacie oczekiwanym przez ChatGPT, więc konektor działa również w zwykłym trybie konektorów / Deep Research (wtedy tylko odczyt: wyszukiwanie przepisów i produktów).
- Po zmianach w narzędziach (nowy deploy) odśwież konektor w ustawieniach (Refresh), żeby ChatGPT pobrał nową listę narzędzi.

## 6. Podłączenie do Claude

**claude.ai** (Pro / Max / Team / Enterprise):
1. Settings → **Connectors** → **Add custom connector**.
2. Name: `Meal Planner`, Remote MCP server URL: `https://<host>/api/mcp/<MCP_ACCESS_TOKEN>`. Pola OAuth (Advanced) zostaw puste → Add.
3. W czacie włącz konektor w menu narzędzi (ikona suwaków / „Search and tools”). Przy pierwszym użyciu narzędzia zapisującego Claude zapyta o zgodę („Allow once” / „Always allow”).

**Claude Code** (terminal):

```bash
claude mcp add --transport http meal-planner https://<host>/api/mcp/<MCP_ACCESS_TOKEN>
# lokalnie:
claude mcp add --transport http meal-planner http://localhost:3000/api/mcp/<MCP_ACCESS_TOKEN>
```

Alternatywnie z nagłówkiem: `claude mcp add --transport http meal-planner https://<host>/api/mcp/x --header "Authorization: Bearer <MCP_ACCESS_TOKEN>"`. Sprawdzenie: `claude mcp list` lub `/mcp` w sesji.

## 7. Przykładowe polecenia

- „Wymyśl nowy obiad na 2 dni dla mnie i dla <imię>, zgodnie z zasadami.”
- „Ułóż plan na 4 dni od poniedziałku.”
- „Wygeneruj listę zakupów na czwartek–niedzielę dla nas obojga.”
- „Uzupełnij wielkości opakowań dla produktów, które ich nie mają (zapytaj mnie o każdy).”
- „Pokaż, które przepisy łamią zasadę opakowań, i zaproponuj poprawki ilości.”
- „Skopiuj plan z dzisiaj na jutro i oznacz dzisiejsze śniadanie jako zjedzone.”

Dobra praktyka: na początku rozmowy powiedz „najpierw pobierz zasady” – asystent wywoła `get_recipe_rules` i `get_household`, więc będzie wiedział, kto jest „ja”, kto jest drugą osobą i jakie są widełki kalorii.

## 8. Analiza i uzupełnienie zasad

Skrypt [`scripts/analyze-recipes.mjs`](../../scripts/analyze-recipes.mjs) czyta obecne produkty, przepisy (z wariantami domowników) i plan z ostatnich 90 dni, i liczy to, czego brakuje w zasadach.

```bash
node scripts/analyze-recipes.mjs
# opcje:
#   --household <uuid>   inne gospodarstwo niż pierwsze w bazie
#   --out <plik.md>      domyślnie docs/mcp/analysis-output.md
#   --json <plik.json>   surowe dane + wynik analizy
#   --fixture <plik.json> zamiast Supabase (test: scripts/fixtures/analyze-recipes.sample.json)
```

Wymaga `NEXT_PUBLIC_SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` (czyta `.env.local`). Tylko odczytuje dane.

Raport zawiera (sekcje 1–7): domowników i liczby, produkty bez wielkości opakowania (od najczęściej używanych), każdy posiłek z kcal/białkiem na osobę i ułamkiem opakowania na składnik, statystyki kcal/białka per kategoria i osoba, typowe ilości, odsetek składników spełniających zasadę opakowań wraz z „winowajcami” oraz to, jak często ten sam posiłek jest w planie dzień po dniu.

Co przenieść do [`src/lib/mcp/recipe-rules.ts`](../../src/lib/mcp/recipe-rules.ts):
1. **Widełki kcal** (sekcja 2 zasad): blok „Gotowe do wklejenia” z sekcji 4 raportu (p25–p75, zaokrąglone do 10). Jeśli osoby jedzą wyraźnie różne porcje, wpisz widełki osobno dla każdej.
2. **Białko w obiedzie i kolacji**: linie „Białko na osobę” z tego samego bloku.
3. **Typowe ilości** (sekcja 3 zasad): blok z sekcji 5 raportu; wybierz okrągłe wartości.
4. Opcjonalnie: jeśli sekcja 7 pokazuje, że często gotujecie na 2 dni, zostaw to jako domyślną strategię w punkcie 1 zasad.
5. Podbij `RECIPE_RULES_VERSION` (np. `'0.1-draft'` → `'1.0'`), żeby w rozmowie było widać, którą wersję zasad asystent dostał.

Raport zawiera dane gospodarstwa (imiona, identyfikatory) – nie commituj go.

## 9. Bezpieczeństwo i ograniczenia

- **Service role omija RLS.** Bezpieczeństwo danych zależy od kodu serwera: każde narzędzie zawęża zapytania do gospodarstwa „acting usera” ([`src/lib/mcp/context.ts`](../../src/lib/mcp/context.ts), [`src/lib/mcp/supabase-admin.ts`](../../src/lib/mcp/supabase-admin.ts)). Nowe narzędzia muszą robić to samo.
- **Jeden użytkownik.** Konektor zawsze działa jako osoba z `MCP_ACTING_USER_*`, niezależnie od tego, kto z niego korzysta w ChatGPT/Claude. Druga osoba jest dostępna jako domownik (np. „zaplanuj dla nas”), ale nie loguje się sama.
- **Rotacja tokenu**: wygeneruj nowy `MCP_ACCESS_TOKEN`, podmień w Vercel (Redeploy) i `.env.local`, potem zaktualizuj URL konektora w ChatGPT / Claude (usuń i dodaj ponownie albo edytuj URL). Stary token przestaje działać od razu po deployu. Zrób to po każdym podejrzeniu wycieku (np. URL wklejony w złe miejsce, tunel zostawiony włączony).
- Klucza service role nie da się „zawęzić” – jeśli wycieknie, zrotuj go w Supabase (Project Settings → API) i zaktualizuj wszędzie.
- **Ścieżka rozwoju: OAuth 2.1.** Docelowo zamiast tokenu w URL: serwer MCP jako zasób chroniony OAuth 2.1 z Supabase Auth jako serwerem autoryzacji (ChatGPT i Claude obsługują OAuth w konektorach). Wtedy konektor działa jako zalogowany użytkownik z jego JWT, zapytania idą przez RLS (bez service role), a `MCP_ACCESS_TOKEN` i `MCP_ACTING_USER_*` przestają być potrzebne.

## 10. Rozwiązywanie problemów

| Objaw | Przyczyna / co zrobić |
| --- | --- |
| `401 Unauthorized` | Zły lub za krótki token; brak `MCP_ACCESS_TOKEN` w env środowiska (Vercel: czy był Redeploy?). |
| HTML strony logowania zamiast JSON | Middleware nie pomija `/api/mcp` (krok 4, punkt 5). |
| Błąd `MCP: no Supabase user found with email ...` | Literówka w `MCP_ACTING_USER_EMAIL`; użyj `MCP_ACTING_USER_ID`. |
| `acting user does not belong to any household` | Użytkownik nie jest w `household_users`. |
| Błąd o kolumnie `package_size` | Nie uruchomiono migracji `docs/add-package-size-to-products.sql`. |
| ChatGPT nie widzi nowych narzędzi | Settings → Apps & Connectors → konektor → Refresh. |

## 10. Każdy domownik ze swoim ChatGPT (tokeny per osoba)

Konektor może działać w imieniu różnych osób. Zamiast jednego `MCP_ACCESS_TOKEN` ustaw
`MCP_ACCESS_TOKENS` z parami `<token>=<e-mail użytkownika Supabase>` rozdzielonymi średnikiem:

```
MCP_ACCESS_TOKENS="k3J...a1=tomasz@example.com;Qp9...z7=kasia@example.com"
```

- Każdy token generujesz osobno (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
- Każda osoba dodaje w swoim ChatGPT konektor z adresem `https://<host>/api/mcp/<swój token>`
  (Developer mode, "No authentication") i działa jako siebie: `get_household` zwraca ją jako `is_me`,
  plan i warianty posiłków dotyczą jej konta, a drugiego domownika wskazuje po imieniu.
- Zamiast e-maila można podać UUID użytkownika (Supabase → Authentication → Users).
- Token to jedyne zabezpieczenie: traktuj adres jak hasło, nie wklejaj go do wspólnych czatów.
  Zmiana tokenu = zmiana wartości w zmiennej i nowy adres w ChatGPT.
- Stara konfiguracja (`MCP_ACCESS_TOKEN` + `MCP_ACTING_USER_EMAIL`) nadal działa równolegle.

Docelowo (patrz `TODO.md`): OAuth 2.1 przez Supabase Auth, czyli logowanie własnym kontem
podczas dodawania konektora, bez tokenów w adresie i bez klucza service role.
