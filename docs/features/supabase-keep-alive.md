# Keep-alive bazy Supabase

**Status:** zatwierdzony 2026-10-10 · **Branch/commit:** `main` / `81513de` + `089e203`

## Co robi

Supabase na darmowym planie pauzuje projekt po ok. 7 dniach bez aktywności, a sam odczyt
nie zawsze jest liczony. Endpoint `GET /api/keep-alive` robi prawdziwy zapis: wstawia
wiersz do tabeli `public.keep_alive`, od razu go usuwa i sprząta wiersze starsze niż doba
(po nieudanych przebiegach). Vercel Cron wywołuje go codziennie o 6:00 UTC.

## Gdzie w kodzie

| Element | Plik | Uwagi |
| --- | --- | --- |
| Route HTTP | `src/app/api/keep-alive/route.ts` | sprawdza `Authorization: Bearer <CRON_SECRET>`, 401 bez niego |
| Logika | `src/lib/keep-alive.ts` | `isAuthorized`, `runKeepAlive` (insert → delete → sweep) |
| Testy | `src/lib/keep-alive.test.ts` | fake klienta Supabase w pamięci |
| Harmonogram | `vercel.json` | cron `0 6 * * *`; Vercel sam dodaje nagłówek z `CRON_SECRET` |
| Backup | `.github/workflows/keep-alive.yml` | co 3 dni + ręcznie; wymaga sekretów `KEEP_ALIVE_URL`, `CRON_SECRET` w GitHub |
| Baza danych | `docs/add-keep-alive.sql` | tabela `keep_alive`, RLS włączone bez polityk (tylko service role) |
| Wyjątek w auth proxy | `src/proxy.ts` | `api/keep-alive` w matcherze, inaczej 307 na `/login` |
| Zmienne środowiskowe | `.env.example` | `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |

## Decyzje i dlaczego

- Decyzja: zapis + usunięcie zamiast samego `SELECT`. Dlaczego: Tomasz zgłosił, że dotychczasowy
  keep-alive oparty na odczycie nie działał; zapis jest jednoznaczną aktywnością.
- Decyzja: osobna tabela zamiast pisania do tabel domenowych. Dlaczego: brak ryzyka śmieci
  w danych użytkowników; RLS bez polityk odcina dostęp z przeglądarki.
- Decyzja: Vercel Cron jako główny mechanizm, GitHub Actions jako zapas. Dlaczego: cron Vercela
  żyje razem z deployem; GitHub wyłącza harmonogramy po 60 dniach bez commitów.
- Decyzja: częstotliwość raz dziennie. Dlaczego: plan Hobby na Vercelu pozwala tylko na dzienną
  granulację; wystarczy z dużym zapasem wobec 7-dniowego limitu.
- Decyzja: autoryzacja przez `CRON_SECRET` (konwencja Vercela), service role w route.
  Alternatywa odrzucona: publiczny endpoint bez sekretu (każdy mógłby generować zapisy).

## Jak sprawdzić

1. W Supabase → SQL Editor uruchomiony `docs/add-keep-alive.sql`; w Vercel ustawione `CRON_SECRET`
   i `SUPABASE_SERVICE_ROLE_KEY`, po nich redeploy.
2. Bez nagłówka: `curl https://<host>/api/keep-alive` → 401 `{"ok":false,"error":"unauthorized"}`.
3. Z nagłówkiem: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<host>/api/keep-alive`
   → `{"ok":true,"deleted":1,"swept_stale":0,...}`. Sprawdzone na produkcji 2026-10-10.
4. Vercel → Settings → Cron Jobs: wpis `/api/keep-alive`; w Logs codzienny wpis ok. 6:00 UTC.
5. `npm test` → `src/lib/keep-alive.test.ts` zielony.

## Znane ograniczenia / do zrobienia

- Brak alertu, gdy cron zacznie failować (błędy widać tylko w logach Vercela).
- Sekret ustawiony przy pierwszym teście był krótki; warto podmienić na losowy 32-bajtowy.
