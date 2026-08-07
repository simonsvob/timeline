# Biblická časová osa

Webová aplikace pro zadávání a prohlížení biblické časové osy. Obsah si vyplňuje
uživatel sám — aplikace je nástroj na vstup a vizualizaci dat, žádná data
nepředvyplňuje. Rozhraní je kompletně česky.

- **Prohlížení je veřejné** (kdokoli s URL).
- **Editace jen po přihlášení**, vynuceno přes Supabase RLS. Registrace není
  veřejná — účty zakládá správce ručně v Supabase.
- Primární zařízení: Mac (Safari/Chrome) a iPad (Safari, na výšku i na šířku),
  včetně plnohodnotného zadávání dat na iPadu. Telefon je použitelný pro
  prohlížení.

Navazujete na rozdělanou práci? Stav projektu a dosavadní rozhodnutí jsou
v [`docs/kontext-projektu.md`](docs/kontext-projektu.md), pokyny pro Claude Code
v [`CLAUDE.md`](CLAUDE.md).

## Stack

| Vrstva | Technologie |
| --- | --- |
| Frontend | React + TypeScript + Vite |
| Backend | Supabase (Postgres + Auth + RLS), přístup přímo přes `@supabase/supabase-js` |
| Osa | vlastní vykreslení do Canvasu 2D (žádná timeline knihovna) |
| Deploy | Netlify (build z GitHub repa) |

Vlastní server neexistuje; prohlížeč mluví se Supabase přímo a zápisy hlídá RLS.

## Rychlý start

```bash
npm install
cp .env.example .env     # a doplnit hodnoty z Supabase
npm run dev              # http://localhost:5173
npm test                 # unit testy
npm run build            # produkční build do dist/
```

Bez vyplněných proměnných prostředí se aplikace nespustí naprázdno — zobrazí
obrazovku s nápovědou, co doplnit.

## Nastavení Supabase

### 1. Projekt a migrace

Vytvořte projekt na [supabase.com](https://supabase.com) a spusťte migraci
`supabase/migrations/20250101000000_init.sql`. Buď přes **SQL Editor**
(zkopírovat obsah souboru a spustit), nebo přes CLI:

```bash
supabase link --project-ref <ref-projektu>
supabase db push
```

Migrace založí tabulky `categories` a `events`, kontrolní constraints
(den vyžaduje měsíc, u rozsahu konec >= začátek, bod nemá koncová pole),
triggery na `updated_at` a RLS politiky.

### 2. RLS

Migrace zapíná RLS na obou tabulkách a nastavuje:

| Operace | Kdo |
| --- | --- |
| `SELECT` | `anon` i `authenticated` |
| `INSERT`, `UPDATE`, `DELETE` | jen `authenticated` |

Po spuštění migrace si v **Table Editor → RLS** ověřte, že je u obou tabulek
RLS aktivní. Anonymní klíč tak nikdy nedokáže data měnit.

### 3. Účet editora

Registrace v aplikaci není — účet se zakládá ručně:

1. **Authentication → Users → Add user → Create new user**
2. Vyplňte e-mail a heslo, zaškrtněte **Auto Confirm User** (jinak by účet čekal
   na potvrzovací e-mail).

Stačí jeden sdílený účet, jehož heslo zná víc lidí. Oprávnění stojí na roli
`authenticated`, ne na vlastnictví záznamů, takže na počtu účtů nezáleží —
další účty lze kdykoli přidat stejným postupem a nic se tím nemění. Aplikace
si u záznamů nepamatuje autora, jen časy vzniku a poslední úpravy.

Volitelně v **Authentication → Providers → Email** vypněte „Enable signups“,
aby veřejná registrace nešla vůbec.

### 4. Proměnné prostředí

Hodnoty najdete v **Project Settings → API**:

| Proměnná | Kde ji vzít |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon / public key |

Lokálně patří do `.env` (viz `.env.example`), na Netlify do Site settings.
Anon klíč je určen do prohlížeče — bezpečnost stojí na RLS, ne na jeho utajení.
Klíč `service_role` do aplikace **nikdy** nepatří.

## Deploy na Netlify

1. **Add new site → Import an existing project** a vyberte GitHub repozitář.
2. Build nastavení se načte z `netlify.toml`:
   - build command `npm run build`
   - publish directory `dist`
3. **Site settings → Environment variables**: přidejte `VITE_SUPABASE_URL`
   a `VITE_SUPABASE_ANON_KEY`. Proměnné se zapékají do buildu, takže po jejich
   změně je potřeba znovu deploynout.
4. Deploy. `netlify.toml` obsahuje i SPA fallback na `index.html`.

## Časový model

Nejdůležitější část aplikace. Podrobnosti jsou v komentářích `src/lib/time.ts`
a `src/lib/format.ts`.

### Astronomické číslování roků

Roky se interně ukládají astronomicky: **1 př. n. l. = 0**, 2 př. n. l. = −1,
1512 př. n. l. = −1511, 1 n. l. = 1. Rok nula historicky neexistuje;
astronomické číslování ho zavádí proto, aby aritmetika (rozdíly let, škálování
na ose) fungovala bez výjimek přes přelom letopočtu.

Převod se děje **jen ve vstupní a zobrazovací vrstvě** — uživatel zadává kladné
číslo roku a přepínač éry, astronomickou hodnotu nikdy nevidí. Rok 0 formulář
odmítne.

Historická data se **nepočítají přes JS `Date`** — neumí spolehlivě roky
př. n. l. a vnucuje falešnou přesnost.

### Přesnost není totéž co jistota

Každý časový údaj má dvě nezávislé vlastnosti:

1. **Přesnost** — co je vyplněno (rok / rok+měsíc / rok+měsíc+den). Odvozuje se
   z vyplněných polí. Nikde se nesmí zobrazit přesnost, která nebyla zadána:

   | Zadáno | Zobrazí se |
   | --- | --- |
   | rok | `607 př. n. l.` |
   | rok + měsíc | `říjen 607 př. n. l.` |
   | rok + měsíc + den | `7. října 607 př. n. l.` |

2. **Jistota** — boolean „přibližné", nezávislý na přesnosti. V textu se uvozuje
   vlnovkou (`~1450 př. n. l.`), na ose přechodem do ztracena (pruh) nebo
   měkkým halem (bod).

3. **Otevřenost** — `qualifier`, opět nezávislý na obojím. Rok není znám, ví se
   jen, že leží za zadanou hodnotou: `min` („žil nejméně do", `min. 64 n. l.`)
   a `after` („po roce", `po roce 874 př. n. l.`). Na ose končí pruh ostrou
   hranou se šipkou — vědomě jinak než přibližnost, protože jde o jiné tvrzení:
   „min. 64" znamená, že rok neznáme; „~64" že ho odhadujeme. Údaj může nést
   obojí najednou (`min. ~65 n. l.`).

Kalendáře se nepřevádějí (žádný juliánský/gregoriánský přepočet) — data se
ukládají a zobrazují tak, jak byla zadána.

## Ovládání osy

Osa nemá nástrojovou lištu — gesta zvládnou totéž rychleji.

| Akce | Trackpad / myš | iPad |
| --- | --- | --- |
| Zoom | pinch dvěma prsty (nebo Ctrl + kolečko) | pinch dvěma prsty |
| Posun | dvouprstové posouvání, tažení | tažení prstem |
| Přiblížit / oddálit skokem | dvojklik / Alt + dvojklik | — |
| Výběr záznamu | klik | ťuknutí |

Samotné kolečko myši posouvá, nepřibližuje. **Hledání** v hlavičce odscrolluje
a přiblíží na vybraný záznam. **Minimapa** dole ukazuje celý rozsah; tažením
výřezu se osa posouvá, kliknutím skočí. **Legenda kategorií** se objeví, jen
když nějaké kategorie existují, a klikem se kategorie skrývá.

### Jak se čte vykreslení

Bodové události leží v pásmu nahoře jako svislé značky, životy a období pod
nimi jako vodorovné pruhy. Přibližnost se pozná z grafiky, ne z textu:

| | pruh | bodová událost |
| --- | --- | --- |
| jistý údaj | ostrá hrana | ostrá čára s patkami |
| přibližný údaj | přechod do ztracena | rozostření do stran |
| otevřená hranice | ostrá hrana se šipkou | značka se šipkou |

## Export a import

**Data → Exportovat data** stáhne kategorie i záznamy jako jeden JSON soubor
s verzí schématu. Import (jen pro přihlášené) soubor zvaliduje, ukáže náhled
počtů a nabídne dva režimy:

- **Sloučit (upsert podle id)** — záznamy se stejným id se přepíšou, ostatní
  zůstanou.
- **Nahradit vše** — nejprve se smažou všechna data, pak se nahraje soubor.

Oba režimy potvrzuje dialog. Záznamům bez `id` se id doplní, odkaz na
neexistující kategorii se zahodí.

## Testy

```bash
npm test          # jednorázově
npm run test:watch
```

Pokryté oblasti (Vitest, bez DOM — testuje se čistá logika):

| Soubor | Co ověřuje |
| --- | --- |
| `src/lib/time.test.ts` | astronomické roky, přelom letopočtu, rozdíly let, spojitá osa |
| `src/lib/format.test.ts` | formátování podle přesnosti a jistoty |
| `src/lib/validation.test.ts` | validace formuláře (rok 0, den bez měsíce, konec před začátkem, souřadnice) |
| `src/lib/lanes.test.ts` | lane packing |
| `src/lib/viewport.test.ts` | zoom, posun, adaptivní měřítko |
| `src/components/timeline/layout.test.ts` | rozvržení pruhů a popisků na ose |
| `src/data/transfer.test.ts` | export a import JSON |

## Data z knihy

V repozitáři je připravený převod tří časových os z knihy *Odvážně choď s Bohem*:

| Soubor | Obsah |
| --- | --- |
| `data/zdroj-odvazne-chod-s-bohem.json` | přepis knihy tak, jak přišel (70 záznamů) |
| `scripts/prevod-wcg.mjs` | převod do formátu aplikace |
| `data/odvazne-chod-s-bohem.json` | výsledek — nahratelný přes **Data → Importovat** |

```bash
node scripts/prevod-wcg.mjs         # přegeneruje data/odvazne-chod-s-bohem.json
node scripts/prevod-wcg.mjs --sql   # vypíše SQL s upsertem podle id
```

Záznamy dostávají stabilní UUID odvozené ze slugu, takže opakovaný import
přepíše totéž a nevytvoří kopie. Samuel a „SVĚTOVÁ VELMOC: Egypt" jsou v knize
na dvou osách se stejnými roky — v datech jsou jednou, s poznámkou.

## Struktura projektu

```
src/
  i18n/cs.ts                 všechny texty rozhraní na jednom místě
  lib/
    time.ts                  astronomické roky, přesnost, spojitá osa
    format.ts                české formátování dat
    validation.ts            validace formuláře
    lanes.ts                 lane packing
    viewport.ts              zoom, posun, adaptivní měřítko
    supabase.ts              klient
  data/
    types.ts                 doménové typy
    repository.ts            jediné místo, které zná tvar tabulek
    transfer.ts              export/import
  state/store.tsx            data + přihlášení
  components/
    timeline/                rozvržení, vykreslení do Canvasu, plátno, minimapa
    TimelineView.tsx         osa + nástrojová lišta + legenda
    TableView.tsx            tabulkový přehled
    EventForm.tsx            formulář záznamu
    CategoryManager.tsx      správa kategorií
    DetailPanel.tsx          detail záznamu
    DataPanel.tsx            export/import
supabase/migrations/         SQL migrace
```

Datová vrstva (`data/`) je oddělená od vizualizace, aby šlo později přidat
mapový pohled nebo pohledy podle období a postav bez zásahu do osy. Sloupce
`place_name`, `lat`, `lng` a `tags` se už ukládají a zobrazují, samotné pohledy
zatím nejsou.

## Co aplikace záměrně neumí

- relativní datování („X let po Y") — jen absolutní roky,
- drag & drop editaci na ose (veškerá editace jde formulářem),
- veřejnou registraci uživatelů,
- mapový pohled a pohledy podle období/postav,
- převod kalendářů.
