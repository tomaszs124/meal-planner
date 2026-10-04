# Meal Planner

Mobile-first web app for a small household to plan meals, keep a shared product base with
nutrition data, and shop from a real-time synchronised list. Built with Next.js (App Router),
TypeScript, Tailwind CSS v4 and Supabase (Postgres, Auth, Realtime, Storage).

## Features

- **Products** with kcal / protein / fat / carbs per 100 g, preferred unit and unit weight,
  categories, notes.
- **Meals** composed of products, with per-member ingredient variants
  (`meal_item_overrides`), tags, categories (breakfast … snack) and photos.
- **Meal plan** per day and per member: pick, randomise, mark eaten / skipped, copy a day
  from yesterday or from another member, weekly progress.
- **Shopping list** generated from the plan for a date range and selected members, grouped by
  dish or by category, servings scaling, real-time sync between phones, custom side lists.
- **PWA**: installable on the home screen.

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase URL and publishable key
npm install
npm run dev                  # http://localhost:3000
```

Database schema and migrations live as SQL files in `docs/` (run them in the Supabase SQL
editor; see `docs/rls-audit.md` for the recommended order and security notes).

## Scripts

| Command           | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | development server                             |
| `npm run build`   | production build (also runs type checks)       |
| `npm run lint`    | ESLint (CI runs it with `--max-warnings=0`)    |
| `npm test`        | unit tests (Vitest)                            |
| `npm run test:watch` | tests in watch mode                         |

## Project layout

```
src/app/            routes (App Router), error boundaries, manifest
src/components/     feature folders: Meals, MealPlanner, ShoppingList, Products, Settings, ui
src/hooks/          shared hooks (useCurrentUser, useProducts cache)
src/lib/            pure logic: nutrition, meals-data loader, shopping aggregation, plan helpers
src/proxy.ts        auth gate (redirects anonymous users to /login)
docs/               SQL migrations, backlog (improvements.md), RLS audit
```

Pure logic in `src/lib/` and the helpers next to components are unit-tested; UI components
are kept thin (data hooks + presentational pieces).

## Documentation

- `docs/improvements.md`: backlog and what was done when.
- `docs/rls-audit.md`, `docs/rls-hardening.sql`: row-level-security review and proposed fixes.
- `docs/overview.md`: original product brief (Polish).
