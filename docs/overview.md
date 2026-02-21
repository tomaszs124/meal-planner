1. Cel aplikacji

Aplikacja webowa (mobile‑first) do wspólnego planowania posiłków, zakupów i monitorowania zdrowia dla 2 użytkowników (z możliwością rozszerzenia).

Kluczowe założenia:

dostęp przez przeglądarkę (telefon jako główne urządzenie)

logowanie użytkowników

współdzielenie danych w czasie rzeczywistym

edycja listy zakupów jednocześnie przez 2 osoby

2. Główne funkcjonalności
2.1 Użytkownicy i dostęp

rejestracja / logowanie (email + hasło)

możliwość utworzenia wspólnej przestrzeni (household / workspace)

2 użytkowników przypisanych do jednej przestrzeni

2.2 Produkty

baza produktów

każdy produkt zawiera:

nazwę

kaloryczność

jednostkę odniesienia:

100 g

sztuka

łyżka

łyżeczka

zdjęcie (opcjonalne)

możliwość:

dodawania

edycji

usuwania produktów

2.3 Posiłki

posiłek składa się z produktów + ilości

automatyczne liczenie kalorii

możliwość:

tworzenia

edycji

usuwania

oznaczanie posiłku jako zjedzony

dodanie notatki do zjedzonego posiłku

2.4 Plan posiłków

planowanie posiłków na dni (np. tydzień)

opcja:

osobny jadłospis dla użytkownika

wspólny jadłospis (np. zakupy dla 2 osób)

zachowanie osobnej kaloryczności, nawet przy wspólnych zakupach

2.5 Lista zakupów (REAL‑TIME)

lista zakupów generowana:

ręcznie

automatycznie z jadłospisu

funkcje:

dodawanie / usuwanie pozycji

oznaczanie jako „kupione”

synchronizacja w czasie rzeczywistym (2 osoby w sklepie)

2.6 Monitorowanie zdrowia
Pomiary:

masa ciała

obwody:

talia

biodra

udo

biceps

Dziennik dnia:

notatka do dnia

oznaczenie wypróżnienia:

wybór skali (np. Bristol)

krótki opis

2.7 Raporty

podsumowanie dnia:

zjedzone posiłki

kalorie

notatki

wypróżnienia

możliwość generowania raportów (np. historia wypróżnień)

3. Proponowana architektura (REKOMENDACJA)
⭐ Najlepszy wybór: Supabase + React (Next.js)
Dlaczego NIE Firebase?

trudniejsze relacje danych

gorsze zapytania analityczne

vendor lock‑in

Dlaczego Supabase?

PostgreSQL (relacyjna baza – IDEALNA do tego projektu)

real‑time out of the box

auth wbudowany

RLS (bezpieczeństwo danych)

bardzo dobre pod mobile web

3.1 Frontend

Technologie:

Next.js (React)

TypeScript

Tailwind CSS

PWA (instalacja jak aplikacja)

Dlaczego Next.js?

SSR / SEO (na przyszłość)

łatwa obsługa auth

świetny ekosystem

3.2 Backend

Supabase:

Auth (email/password)

PostgreSQL

Realtime subscriptions (lista zakupów!)

Storage (opcjonalnie: zdjęcia posiłków)

3.3 Real‑time (kluczowe)

Supabase Realtime (WebSocket)

subskrypcje na:

listę zakupów

status „kupione”

4. Model danych (UPROSZCZONY)
users

id

email

households

id

name

household_users

user_id

household_id

products

id

name

kcal_per_unit

unit_type

image_url

meals

id

name

user_id

meal_items

meal_id

product_id

amount

meal_plan

date

meal_id

user_id

household_id

shopping_list_items

id

household_id

product_id

amount

is_checked

body_measurements

user_id

date

weight

waist

hips

thigh

biceps

daily_notes

user_id

date

note

bowel_movements

user_id

date

scale

note

5. Bezpieczeństwo

Row Level Security (Supabase)

użytkownik widzi tylko dane swojej przestrzeni

6. MVP – kolejność wdrażania

Auth + household

Produkty

Posiłki

Plan posiłków

Lista zakupów (real‑time)

Oznaczanie zjedzonych posiłków

Notatki + wypróżnienia

Raporty

7. Gotowe do użycia w VS Code

Ten dokument może służyć jako:

README projektu

specyfikacja dla Claude / Copilot

podstawa do generowania kodu

8. Rozszerzenia (na przyszłość)

skanowanie paragonów

AI do planowania posiłków

eksport PDF raportów

przypomnienia push

9. Zasady UX/UI

**OPTIMISTIC UI - ZAWSZE:**

Dodawanie - element pojawia się od razu na liście (po .insert().select().single())

Edycja - zmiany widoczne natychmiast (optimistic update + rollback przy błędzie)

Usuwanie - element znika od razu (optimistic update + rollback przy błędzie)

Real-time - Supabase subscription jako backup dla współdzielonych danych

**NIE WOLNO:**

Wymagać odświeżenia strony po zapisaniu danych

Czekać na odpowiedź z serwera przed pokazaniem zmian

Pozostawiać użytkownika w niepewności czy akcja się powiodła