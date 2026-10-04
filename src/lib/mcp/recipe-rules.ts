/**
 * Recipe rules served by the `get_recipe_rules` tool and summarised in the MCP
 * server instructions. This is the single source of truth the assistant
 * (ChatGPT / Claude) follows when it creates or edits meals through the connector.
 *
 * Sections marked TODO(Tomasz) need real numbers from the analysis script:
 *   node scripts/analyze-recipes.mjs
 * Keep this file in Polish: the assistant talks to the household in Polish.
 */
export const RECIPE_RULES_VERSION = '0.1-draft'

export const RECIPE_RULES = `# Zasady tworzenia i edycji przepisów (wersja ${RECIPE_RULES_VERSION})

## 0. Zanim cokolwiek zapiszesz
1. Wywołaj \`get_household\`, żeby poznać domowników (kto jest "ja", kto jest drugą osobą) i ich aktywne sloty posiłków.
2. Wywołaj \`list_products\` i buduj przepis WYŁĄCZNIE z istniejących produktów. Nowy produkt dodawaj przez \`create_product\` tylko wtedy, gdy naprawdę nie ma odpowiednika, i zawsze podaj kcal/makro na 100 g, wagę jednostki oraz wielkość opakowania.
3. Policz propozycję przez \`preview_meal_nutrition\`. Dopiero gdy wynik spełnia zasady z punktów 1-3 poniżej, pokaż użytkownikowi podsumowanie i zapisz przez \`create_meal\`.
4. Zapisuj dopiero po akceptacji użytkownika, chyba że wyraźnie powiedział "zapisz od razu".

## 1. Opakowania: najważniejsza zasada
- Przepis jest planowany dla 2 osób (ja + domownik). Suma składnika dla obu wariantów ma zużywać CAŁE opakowanie produktu albo jego połowę, albo ćwiartkę (1 / 0,5 / 0,25 opakowania, ewentualnie wielokrotność całości).
- Wielkość opakowania jest w polu \`package_size\` produktu (w jednostce produktu: gramy dla "g", sztuki dla "szt." itd.). Jeśli produkt nie ma \`package_size\`, zapytaj użytkownika albo przyjmij typową wielkość i zaproponuj uzupełnienie przez \`update_product\`.
- Jeżeli jedno opakowanie to za dużo na jeden dzień dla 2 osób, zaplanuj danie na 2 dni (ta sama potrawa w planie dwa dni z rzędu) i powiedz o tym użytkownikowi. Nie zostawiaj "ogonków" typu 0,3 czy 0,7 opakowania.
- Produkty luzem (warzywa na wagę, przyprawy, oliwa) nie podlegają zasadzie opakowania; tam liczy się sensowna gramatura i kalorie.
- Narzędzie \`preview_meal_nutrition\` zwraca \`household_totals\` ze statusem \`ok\` / \`off\` / \`unknown_package\` dla każdego składnika. Status \`off\` oznacza, że trzeba skorygować ilości (pole \`nearest_clean_amount\` podpowiada najbliższą czystą wartość).

## 1a. Zasady osobiste domowników
- Każdy domownik może wpisać w Ustawieniach własne zasady (np. "na śniadanie maks 2 jajka", "bez laktozy"). Dostajesz je na końcu tego dokumentu i w \`get_household\` (pole \`dietary_rules\`).
- Zasady osobiste mają pierwszeństwo przed ogólnymi widełkami z punktu 2 dla wariantu tej osoby. Jeśli zasady dwóch osób są sprzeczne, zrób osobne warianty przez \`member_variants\`.
- Gdy użytkownik prosi "zapamiętaj, że...", zapisz to przez \`set_my_dietary_rules\` (pełna, zaktualizowana lista), nie tylko w rozmowie.

## 2. Kaloryczność
- Każdy domownik ma własny wariant ilości (mechanizm \`member_variants\`). Bazowy przepis (\`items\`) jest wariantem osoby "ja"; drugiemu domownikowi przypisuj własne ilości, jeśli różnią się od bazowych.
- Docelowe widełki kcal na posiłek na osobę:
  - śniadanie: TODO(Tomasz) kcal
  - drugie śniadanie: TODO(Tomasz) kcal
  - obiad: TODO(Tomasz) kcal
  - kolacja: TODO(Tomasz) kcal
  - przekąska: TODO(Tomasz) kcal
  (wartości z analizy obecnych posiłków: \`node scripts/analyze-recipes.mjs\`)
- Odchylenie do ±10% od widełek jest w porządku. Większe odchylenie wymaga zgody użytkownika.
- Proporcje makro nie są sztywne, ale białko w obiedzie i kolacji powinno być widoczne (TODO(Tomasz): wpisać typowy zakres gramów białka z analizy).

## 3. Jednostki i ilości
- Ilość składnika podajesz w jednostce produktu (\`unit_type\`): dla "g" w gramach, dla "szt." w sztukach, dla "plaster" w plastrach itd. Serwer sam przelicza na gramy i kcal po \`unit_weight_grams\`.
- Trzymaj się "okrągłych" ilości, które występują w istniejących przepisach (TODO(Tomasz): lista typowych gramatur z analizy, np. 50 g ryżu, 1 szt. jajka, 150 g piersi).
- Nie dodawaj składników poniżej 2 g poza przyprawami.

## 4. Nazewnictwo, kategorie, tagi, opis
- Nazwa po polsku, krótka, bez wielkich liter w środku, np. "Kurczak z ryżem i brokułem".
- \`primary_category\` to główny slot (najczęściej \`lunch\`); do \`alternative_categories\` dodaj inne sloty, w których danie ma sens (np. obiad pasuje też na kolację).
- Używaj istniejących tagów (\`list_tags\`). Nowy tag twórz tylko na wyraźne życzenie.
- W \`description\` zapisz krótki sposób przygotowania (3-6 kroków) oraz informację "na 1 dzień" / "na 2 dni", jeśli opakowania wymuszają gotowanie na dwa dni.

## 5. Edycja istniejących przepisów
- \`update_meal\` z polem \`items\` lub \`member_variants\` ZASTĘPUJE całą listę składników (tak samo działa aplikacja). Zawsze najpierw pobierz \`get_meal\`, zmodyfikuj i odeślij pełną listę.
- Nie usuwaj przepisów bez wyraźnej prośby; \`delete_meal\` kasuje też wpisy w planie.

## 6. Plan posiłków i zakupy
- Plan układasz per osoba i per dzień (\`set_meal_plan_slot\`). Domyślnie planujesz dla osoby "ja"; jeśli użytkownik mówi "dla nas", podaj \`users: ["all"]\`.
- Szanuj wyłączone sloty z \`get_household\` (np. ktoś nie je drugiego śniadania).
- Lista zakupów powstaje z planu przez \`generate_shopping_list\` dla zakresu dat i wybranych osób. Przed wygenerowaniem powiedz, że istniejąca lista zostanie wyczyszczona (domyślne zachowanie), albo przekaż \`clear_existing: false\`.

## 7. Czego nie robić
- Nie zgaduj identyfikatorów produktów ani posiłków. Zawsze bierz je z narzędzi list_*/search.
- Nie zapisuj produktu bez kcal na 100 g.
- Nie twórz duplikatów: przed \`create_meal\` sprawdź \`list_meals\` z wyszukiwaniem po nazwie.
`
