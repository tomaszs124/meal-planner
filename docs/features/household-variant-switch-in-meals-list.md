# Przełącznik wariantów domowników na liście posiłków

**Status:** zatwierdzony 2026-10-10 · **Branch/commit:** `main` / (commit poniżej w historii: "Meals list: household variant switch in meal details")

## Co robi

W modalu szczegółów posiłku otwieranym z zakładki **Posiłki** pojawia się sekcja
„Warianty dla domowników” z przyciskami „Mój przepis” / `<imię domownika>` (np. „Dagmara”).
Wcześniej ten przełącznik był widoczny tylko po wejściu w posiłek z planu dnia.
Przełączenie podmienia listę składników i wartości odżywcze na wariant wybranej osoby
(nadpisania z `meal_item_overrides`); jeśli osoba nie ma wariantu, pokazuje przepis bazowy.

## Gdzie w kodzie

| Element | Plik | Uwagi |
| --- | --- | --- |
| UI przełącznika i logika wariantów | `src/components/MealPlanner/MealDetailsModal.tsx` | props `showVariantSelector`, `initialVariantUserId`; ładowanie domowników i nadpisań |
| Włączenie na liście posiłków | `src/components/Meals/MealDetailsWithActions.tsx` | przekazuje `showVariantSelector={true}` i `initialVariantUserId={userId}` |
| Wzorzec z planu dnia | `src/components/MealPlanner/MealSlot.tsx` | to samo wywołanie, skąd skopiowano zachowanie |
| Baza danych | `docs/add-meal-item-overrides.sql` | tabela `meal_item_overrides` (wariant = nadpisane składniki per użytkownik) |

## Decyzje i dlaczego

- Decyzja: zero nowej logiki, tylko włączenie istniejących props w jednym miejscu.
  Dlaczego: modal już obsługiwał warianty dla planu dnia; duplikowanie kodu nie miało sensu.
- Decyzja: domyślnie wybrany „Mój przepis” (`initialVariantUserId = userId`), tak jak w planie.
  Dlaczego: spójne zachowanie w obu miejscach; użytkownik widzi najpierw swoją wersję.
- Nieruszone: modal szczegółów w pickerze posiłków (`MealPickerModal.tsx`) nadal nie pokazuje
  przełącznika. Alternatywa odrzucona na razie: włączenie go tam też (jedna linia, jeśli zajdzie potrzeba).

## Jak sprawdzić

1. Zaloguj się na konto w gospodarstwie z co najmniej dwiema osobami.
2. Zakładka Posiłki → kliknij dowolny posiłek → w modalu pod tagami jest sekcja „Warianty dla domowników”.
3. Kliknij imię domownika: składniki i kcal zmieniają się na jego wariant (albo zostają bazowe, jeśli wariantu nie ma).
4. Dla konta w gospodarstwie jednoosobowym sekcja nie pojawia się wcale.

## Znane ograniczenia / do zrobienia

- Picker posiłków przy dodawaniu do planu nie ma przełącznika.
