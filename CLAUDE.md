# Meal Planner

Aplikacja Next.js + Supabase do planowania posiłków dla gospodarstwa domowego.
Architektura i mapa kodu: `docs/architecture.md`. Backlog: `docs/improvements.md`.
Konektor MCP: `docs/mcp/setup.md`.

## Komendy

- `npm run dev`, `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npm test` (Vitest).
- Migracje SQL: pliki w `docs/*.sql`, uruchamiane ręcznie w Supabase → SQL Editor.

## Dokumentacja feature'ów

Szablon: `docs/features/_TEMPLATE.md`. Jeden feature = jeden plik.

| Feature | Plik |
| --- | --- |
| Przełącznik wariantów domowników na liście posiłków | `docs/features/household-variant-switch-in-meals-list.md` |
| Keep-alive bazy Supabase (cron, zapis + usunięcie) | `docs/features/supabase-keep-alive.md` |
