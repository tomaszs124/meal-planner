# Tryb offline (service worker)

Lista zakupów jest używana w sklepie, gdzie zasięg bywa słaby. Aplikacja ma więc
ostrożną warstwę offline: service worker, który **niczego nie precache'uje**, a jedynie
zapamiętuje to, co użytkownik już raz pobrał, i podaje to, gdy sieć nie odpowiada.

## Pliki

| Plik | Rola |
|---|---|
| [`public/sw.js`](../public/sw.js) | Service worker (czysty JS, bez bibliotek). |
| [`src/components/ui/ServiceWorkerRegistration.tsx`](../src/components/ui/ServiceWorkerRegistration.tsx) | Rejestracja SW (tylko produkcja); w dev wyrejestrowuje stare SW. Eksportuje `clearServiceWorkerUserCaches` / `warmServiceWorkerRoutes` używane przez `CurrentUserProvider`. |
| [`src/components/ui/OfflineBanner.tsx`](../src/components/ui/OfflineBanner.tsx) | Pasek „Brak połączenia…” nad dolną nawigacją (`role="status"`). |
| [`src/app/layout.tsx`](../src/app/layout.tsx) | Montuje oba komponenty obok `<BottomNav />`. |
| [`src/proxy.ts`](../src/proxy.ts) | Matcher wyklucza `/sw.js` (inaczej anonimowy użytkownik dostałby redirect na `/login` zamiast skryptu). |

## Co jest cache'owane

| Żądanie | Strategia | Cache | Limit |
|---|---|---|---|
| `/_next/static/**` (pliki z hashem) | cache-first | `mp-static-<wersja>` | 300 |
| Nawigacje HTML (`request.mode === 'navigate'`) | network-first, timeout 4 s → ostatnia zapisana wersja tej samej ścieżki (bez query) | `mp-pages-<wersja>` | 30 |
| Supabase REST `GET /rest/v1/...` | network-first bez limitu czasu → cache tylko przy błędzie sieci lub offline | `mp-rest-<wersja>` | 200 |
| Obrazy Supabase `/storage/v1/object/public/...` oraz `/_next/image?url=<ten storage>` | cache-first | `mp-images-<wersja>` | 100 |

Szczegóły:

- Zapisywane są wyłącznie odpowiedzi ze statusem **200**. Strony HTML dodatkowo muszą być
  same-origin, bez przekierowania i z `Content-Type: text/html` — strony błędów i redirect
  na `/login` nie trafiają do cache.
- Limit działa jak proste LRU po czasie zapisu: przy przekroczeniu usuwane są najstarsze wpisy.
- Klucz REST to URL + nagłówki `Accept`, `Accept-Profile`, `Prefer` (zmieniają kształt
  odpowiedzi, np. `.single()` czy `count`). Nagłówka `Authorization` nie da się użyć
  w kluczu, dlatego cache stron i REST jest **czyszczony przy wylogowaniu** (SW obserwuje
  `POST /auth/v1/logout`, nie przechwytując go) oraz gdy nawigacja kończy się na `/login`.
- Gdy sieć odpowie po timeoucie, odpowiedź i tak odświeża cache (na następny raz).
- Adres Supabase SW dostaje z URL rejestracji: `/sw.js?supabase=<origin>`.

### Odstępstwo od „stale-while-revalidate” dla REST

Rozważane było SWR, ale przy danych edytowanych przez użytkownika (odhaczanie produktów)
oznaczałoby, że **online** każde wczytanie pokazuje stan sprzed ostatniego zapisu, a świeża
odpowiedź trafia tylko do cache. Network-first z timeoutem daje świeże dane, gdy sieć
działa, i dane z cache tylko gdy nie działa lub jest bardzo wolna.

## Czego NIE cache'ujemy

- Żądań innych niż `GET` (zapisy, `HEAD`) i żądań z nagłówkiem `Range`.
- `/api/**`, `/auth/**` aplikacji, samego `/sw.js`.
- Supabase `/auth/v1/**`, `/realtime/**`, prywatnego `/storage/**`.
- Payloadów RSC (`?_rsc=`, nawigacje klienckie przez `<Link>`/`router.push`) i prefetchy.
- Pozostałych plików z `public/` i innych originów.

## Jak podbić wersję cache

W `public/sw.js` zmień `CACHE_VERSION` (np. `'v1'` → `'v2'`). Po wdrożeniu przeglądarka
pobierze nowy SW (rejestracja z `updateViaCache: 'none'`), `install` wywoła `skipWaiting()`,
a `activate` usunie wszystkie cache z prefiksem `mp-` innej wersji i zrobi `clients.claim()`.
Strona **nie jest przeładowywana automatycznie** (mogłaby zgubić wypełniany formularz) —
nowy SW obsłuży kolejne żądania.

Podbijaj wersję przy każdej zmianie logiki cache'owania lub formatu kluczy.

## Jak sprawdzić (DevTools)

SW działa tylko w buildzie produkcyjnym: `npx next build && npx next start`.

1. **Application → Service Workers**: powinien być `sw.js?supabase=https%3A%2F%2F…`
   w stanie *activated and is running*. W dev (`next dev`) lista ma być pusta.
2. Przejdź po aplikacji (zwłaszcza `/shopping-list`), potem **Application → Cache Storage**:
   `mp-static-v1`, `mp-pages-v1`, `mp-rest-v1`, ewentualnie `mp-images-v1`.
3. **Network → Offline** (lub *Slow 3G*), przeładuj `/shopping-list`: strona i lista
   powinny się wczytać z cache (kolumna Size: „(ServiceWorker)”), na dole pojawia się
   bursztynowy pasek „Brak połączenia…”.
4. Wyłącz Offline — pasek znika.
5. Wyloguj się i sprawdź, że `mp-pages-v1` i `mp-rest-v1` zniknęły.
6. Aby zacząć od zera: **Application → Storage → Clear site data**.

## Znane ograniczenia

- **Zapisy offline nie działają** — odhaczenie produktu czy dodanie pozycji bez sieci
  zakończy się błędem; nie ma kolejki synchronizacji.
- **Realtime nie działa offline** — zmiany innych domowników nie dotrą do czasu powrotu sieci.
- **Pierwsza wizyta wymaga sieci** — nic nie jest precache'owane; offline zadziała tylko
  dla stron i zapytań, które były wcześniej pobrane na tym urządzeniu.
- **Nawigacje klienckie offline** (klik w dolną nawigację) korzystają z RSC, którego nie
  cache'ujemy — mogą się nie udać; pełne przeładowanie strony zadziała z cache.
- **Dane z cache mogą być nieaktualne** aż do następnego udanego pobrania; dotyczy to też
  zmian uprawnień (RLS) — odpowiedź zapisana przed zmianą może być pokazana offline.
- Wolna sieć (> 4 s) skutkuje pokazaniem powłoki strony z cache; dane z bazy czekają na sieć.

## Poprawki z recenzji (wdrożone 2026-10-11, `CACHE_VERSION` v2)

1. **Odczyty REST bez limitu czasu.** `/rest/v1/` czeka na sieć tak długo, jak odpowiada;
   kopia z cache jest podawana tylko, gdy `fetch` się nie powiedzie albo `navigator.onLine`
   jest `false`. Dzięki temu operacje „odczytaj, przelicz, zapisz” nigdy nie liczą na starych
   danych. Limit 4 s został wyłącznie dla nawigacji HTML (powłoka strony jest statyczna).
2. **Pewne czyszczenie per-user.** SW ma licznik „epoki”: każde czyszczenie go podbija, a
   odpowiedź, której żądanie wystartowało w starszej epoce, nie trafia do cache. Aplikacja
   wysyła `{ type: 'clear-user-caches' }` z `CurrentUserProvider` przy `SIGNED_OUT` i przy
   zmianie użytkownika (oprócz obserwacji `POST /auth/v1/logout`). Czyszczony jest też cache
   zdjęć.
3. **Rozgrzewanie tras.** Po `activate` i po zalogowaniu (`{ type: 'warm-routes' }`) SW
   pobiera `/dashboard`, `/meals`, `/shopping-list`, `/products`, `/settings` do cache stron,
   więc działają offline nawet bez wcześniejszego wejścia w tej sesji. Przekierowanie na
   `/login` (brak sesji) niczego nie zapisuje.

## Włączanie w produkcji

Service worker rejestruje się w każdym buildzie produkcyjnym (brak flagi). W `next dev`
jest wyrejestrowywany. Wyłączenie: usunąć `<ServiceWorkerRegistration />` z `layout.tsx`
albo podbić wersję i zwrócić pusty worker.
