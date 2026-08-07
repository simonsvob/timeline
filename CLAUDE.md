# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Projekt i jeho dokumentace jsou česky. Piš česky — komentáře, texty rozhraní,
commit messages i odpovědi.

## Příkazy

```bash
npm run dev                       # vývojový server (Vite, :5173)
npm test                          # všechny testy jednou
npm run test:watch                # testy v režimu watch
npx vitest run src/lib/time.test.ts          # jeden soubor
npx vitest run -t "přelom letopočtu"         # testy podle názvu
npm run typecheck                 # tsc bez emitu
npm run build                     # tsc -b && vite build

node scripts/prevod-wcg.mjs       # přegeneruje data/odvazne-chod-s-bohem.json
node scripts/prevod-wcg.mjs --sql # vypíše SQL s upsertem podle id
```

Testy běží v prostředí `node`, ne v jsdom — testuje se jen čistá logika
(`src/**/*.test.ts`). Komponenty testy nemají; vizuální chování se ověřuje
spuštěním aplikace.

## Časový model — čti dřív, než sáhneš na cokoli s daty

Tohle je jádro aplikace a nejčastější zdroj chyb.

**Astronomické roky.** Roky se ukládají astronomicky: 1 př. n. l. = `0`,
2 př. n. l. = `-1`, 1 n. l. = `1`. Rok nula neexistuje, astronomické číslování
ho zavádí, aby aritmetika fungovala přes přelom letopočtu bez výjimek. Převod
na letopočet patří **výhradně** do vstupní a zobrazovací vrstvy
(`toAstronomicalYear` / `fromAstronomicalYear` v `src/lib/time.ts`).

**Nikdy nepoužívej JS `Date`** pro historická data — neumí spolehlivě roky
př. n. l. a vnucuje přesnost, kterou údaje nemají. Veškerá časová logika je
vlastní, nad celočíselnými roky.

**Tři nezávislé vlastnosti každého údaje.** Slévat je dohromady je chyba:

| Vlastnost | Kde se bere | Text | Na ose |
|---|---|---|---|
| přesnost | co je vyplněno (`month`, `day`) | `607` / `říjen 607` / `7. října 607` | — |
| jistota (`approx`) | zaškrtnuto ve formuláři | `~1450 př. n. l.` | přechod do ztracena / halo |
| otevřenost (`qualifier`) | `'min'` \| `'after'` | `min. 64 n. l.` / `po roce 874 př. n. l.` | ostrá hrana se šipkou |

Přibližnost se v popisku na ose **neznačí vlnovkou** — je vidět z vykreslení.
Vlnovka patří jen do textového formátování dat (detail, tabulka).

Můžou se potkat: `min. ~65 n. l.` = rok úmrtí neznáme a odhadujeme ho na 65.
**Nikde se nesmí zobrazit přesnost, která nebyla zadána** — záznam s vyplněným
jen rokem se nesmí ukázat jako `1. 1. 607 př. n. l.`.

Kalendáře se nepřevádějí (žádný juliánský/gregoriánský přepočet). Model měsíců
v `MONTH_LENGTHS` má napevno 365 dní a slouží **jen k umístění značky na ose**,
ne k výpočtu skutečných dat.

## Architektura

Vrstvy jsou oddělené záměrně, aby šlo přidat mapový pohled nebo pohled podle
postav bez zásahu do osy:

```
src/i18n/cs.ts     všechny viditelné texty (jinde žádné řetězce)
src/lib/           čistá logika bez DOM a bez závislosti na Supabase
src/data/          jediné místo, které zná tvar tabulek (repository, transfer)
src/state/         React kontext: data + přihlášení
src/components/    UI; components/timeline/ je vykreslovací řetězec
```

**Dvě pásma.** Bodové události se řádkují zvlášť a leží nahoře, rozsahy pod
nimi (`layoutEvents` pakuje každou skupinu zvlášť a řádky rozsahů posune o
`pointLaneCount + BAND_GAP_LANES`). Body se kreslí jako svislé značky, ne
kolečka — jinak se pletly s pruhy.

**Vykreslovací řetězec osy** (`src/components/timeline/`) — tři kroky, každý
v jiném souboru:

1. `layout.ts` — záznamy + výřez → geometrie v pixelech. Volá `packLanes`
   (`src/lib/lanes.ts`) a rozhoduje o umístění a viditelnosti popisků.
   Čistá funkce, měření textu se předává zvenčí, proto má testy.
2. `renderer.ts` — geometrie → kresba na Canvas 2D. Bez Reactu.
3. `TimelineCanvas.tsx` — plátno, gesta (kolečko, tažení, pinch) a rAF smyčka.

Canvas, ne SVG: při stovkách až tisících záznamů a plynulém zoomu se překresluje
celý výřez v každém snímku. Naměřeno 60 fps při 3000 záznamech. Hotové timeline
knihovny se nepoužívají — žádná nezvládá kombinaci př. n. l., plynulého zoomu
přes 6000 let a vlastního vykreslení nejistoty.

**Nesamozřejmosti v layoutu:**

- Řádkuje se **přes všechny záznamy, ne jen viditelné** — jinak by při posunu
  poskakovaly mezi řádky. Ořez na viewport dělá až `renderer.ts`.
- Do obsazeného místa se počítá i šířka popisku. Když by řádků bylo přes
  `MAX_LANES_WITH_LABELS`, přepne se do zhuštěného režimu a popisky, které se
  nevejdou, se skryjí (ukážou se po najetí a v detailu).
- Měření textu je cachované podle řetězce (`measureText` v `TimelineCanvas.tsx`);
  při změně fontu je potřeba cache zneplatnit.
- Popisek u pravého okraje se překlopí doleva od značky, a když ani tam není
  místo, skryje se.

**Gesta.** Přibližuje jen pinch (na trackpadu i myši přichází jako wheel
s `ctrlKey`); samotné kolečko posouvá. Osa nemá nástrojovou lištu, zoom
tlačítky ani skok na rok — gesta je nahradila.

**Zoom a měřítko** (`src/lib/viewport.ts`): výřez je `{ t0, pxPerYear, width }`.
Dělení osy se vybírá jako **nejjemnější, které se ještě vejde** (`chooseTickLevel`),
a zarovnává se na kulaté roky letopočtu, ne na kulaté astronomické hodnoty —
uživatel čeká „4000 př. n. l.", ne „4001 př. n. l.".

## Data a Supabase

Přístup jde přímo z prohlížeče přes `@supabase/supabase-js`, vlastní server
neexistuje. Zápisy hlídá RLS: `SELECT` pro `anon` i `authenticated`, zápis jen
pro `authenticated`. Migrace jsou v `supabase/migrations/`; při změně schématu
přidej migraci **a** promítni ji do `src/data/repository.ts` (seznam sloupců
`EVENT_COLUMNS` je ruční).

Validační pravidla se drží na dvou místech zároveň — v `src/lib/validation.ts`
i jako CHECK constraints v migraci. Když měníš jedno, změň druhé.

Export/import má verzi schématu (`EXPORT_SCHEMA_VERSION` v `src/data/types.ts`).
Import umí načíst i starší verze; při přidání pole verzi zvyš a rozšiř
`SUPPORTED_IMPORT_VERSIONS`.

## Nasazení

Netlify staví z větve `main`. Proměnné `VITE_SUPABASE_URL` a
`VITE_SUPABASE_ANON_KEY` se **zapékají do buildu**, takže po jejich změně je
nutný nový deploy. `netlify.toml` je vyjímá ze skenování tajemství
(`SECRETS_SCAN_OMIT_KEYS`) — bez toho build spadne, protože veřejný anon klíč
z podstaty věci skončí v klientském bundlu.

## Kontext projektu

Stav projektu, dosavadní rozhodnutí a co je rozdělané je v
[`docs/kontext-projektu.md`](docs/kontext-projektu.md). Setup Supabase a Netlify
je v [`README.md`](README.md).
