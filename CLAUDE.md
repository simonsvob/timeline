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
| otevřenost (`qualifier`) | `'min'` \| `'after'` \| `'before'` | `min. 64 n. l.` / `po roce 874` / `před rokem 3896` | šipka na tu stranu, kam je údaj otevřený |

`openDirection` v `time.ts` říká, na kterou stranu je hranice otevřená:
`before` doleva, `min` i `after` doprava.

Přibližná hranice se pozná z vykreslení: pruh vypadá **stejně jako jistý**, jen
se na té straně neuzavře — obrys tam vede jen nahoře a dole. Výplň se nikam
nerozplývá, takže se jméno vejde i do úzkého pruhu.

Otevřený kraj se kreslí přesahem za ořez: tvar se protáhne o `BAR_RADIUS + 4`
ven, ořízne se na skutečnou šířku a zaoblený roh zůstane mimo. Výplň i obrys
tak sdílejí jednu cestu — ručně skládané oblouky se u krátkých pruhů rozpadaly
na kroužky. Ze stejného důvodu má pruh pevný `BAR_RADIUS` (menší než polovina
výšky) a `MIN_BAR_WIDTH`: bez nich se při velkém oddálení srazil poloměr na
polovinu šířky a z pruhů zbyly nitky nebo kolečka.

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

**Model „Řeka".** Osa je jedna vodorovná čára uprostřed plochy. Kolem ní leží
**pásma** — vodorovné pruhy plochy s vlastním řádkováním, definovaná štítky
záznamů. `lane` 0 je řádek nejblíž čáře; hotovou svislou polohu i výšku tvaru
nese každá položka sama (`centerY`, `height`, záporné = nad čárou), vykreslení
si ji nepočítá.

Pilulek se nad čáru vejde jen `MAX_POINT_LANES` řádků. Co se nevejde, ztratí
pilulku (`labelMode: 'none'`) a zůstane jen uzlem na čáře — jinak by při
oddálení pilulky vytlačily osu mimo obrazovku.

**Pásma jsou v `BANDS` v `layout.ts`** — jediné místo, kde se mění pořadí
i štítky. Shora dolů:

| Pásmo | Štítky | Umístění | Tvar | Řada |
|---|---|---|---|---|
| Světové velmoci | `velmoc` | připnuto nahoře | pruhy | jedna |
| Události | `udalost`, `kniha` | plave nad čárou | pilulky | řádkuje se |
| — *centrální čára* — | | | | |
| Životy | `zivot` | plave pod čárou | pruhy | řádkuje se |
| Ostatní | zbytek | plave pod čárou | podle typu | řádkuje se |
| Vláda – Izrael | `vlada-izrael` | připnuto dole | pruhy | jedna |
| Vláda – Juda | `vlada-juda`, `vlada-12kmenu` | připnuto dole | pruhy | jedna |

Pásmo bez záznamů (nebo skryté v legendě) **nezabírá žádné svislé místo**.
`MAX_LANES_WITH_LABELS` a zhuštěný režim se vyhodnocují za každé pásmo zvlášť.

**Připnutá pásma se svisle nehýbou.** Velmoci sedí u horní hrany, vlády u dolní
(Juda úplně dole, Izrael nad ní); plovoucí obsah jim projíždí pod neprůhledným
podkladem. Jsou to souvislé pásy přes celé dějiny — kdyby plavaly s osou,
hledaly by se hůř než cokoli jiného.

Souřadnice `centerY` proto **neznamená totéž pro všechny položky**: u plovoucích
pásem je to odstup od čáry (záporný nad ní), u připnutých odstup od hrany plochy
(vždy kladný, směrem dovnitř). Na pixely plátna to přepočítá `itemY(item, frame)`,
kde `Frame` je `{ axisY, top, bottom }`. `hitTest` bere rovnou souřadnice plátna.

**Pásmo na jedné řadě (`singleLane`) se neřádkuje.** Vlády i velmoci navazují
bez mezer — konec jedné je začátek další — takže by je packing rozházel do
desítek řádků. Popisek se tam vejde jen dovnitř pruhu, nikdy vedle, a sousedé
se odliší **střídavým odstínem** (`shade`), ne mezerou. Pruhy mají menší
zaoblení (`SEGMENT_BAR_RADIUS`) a menší minimální šířku (`MIN_SEGMENT_WIDTH`),
aby četly jako díly jednoho pásu, ne jako řetěz pilulek.

Názvy pásem jsou v `cs.timeline.bands`; na plátně se kreslí do mezery nad
pásmem, jen u pásem na jedné řadě — u ostatních se řada pozná z obsahu.

**Kategorie jsou období.** Kategorie s vyplněným `fromYear`/`toYear` se chová
jako časové období: barví centrální čáru (plynulý gradient přes období ve
výřezu) a dráhu minimapy. Záznamy dědí barvu své kategorie. Filtrování
v legendě už na kategoriích nestojí — čipy nad osou zapínají a vypínají
**pásma**.

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
- Popisek degraduje podle místa (`LabelMode`): jméno + roky uvnitř → jen jméno
  uvnitř → vedle pruhu → nic. Řádkování počítá s reálnou šířkou popisku.
- Jméno na pruhu nese barvu kategorie ztmavenou o 42 % (`darken`), roky tutéž
  barvu poloprůhlednou. Neutrální černá se nepoužívá — text má patřit k pruhu.

**Gesta.** Přibližuje jen pinch, samotné kolečko posouvá. Pinch chodí do
aplikace **dvěma různými cestami** a obě je potřeba obsluhovat: Chrome a Firefox
posílají `wheel` s `ctrlKey`, Safari (Mac i iPad) vlastní `gesturestart` /
`gesturechange` / `gestureend`, kde `scale` je poměr vůči začátku gesta, ne
přírůstek. Na iPadu navíc Safari posílá gesta souběžně s dotyky, které řeší
pinch přes pointery — proto se obsluha gest při dvou aktivních ukazatelích
přeskakuje, jinak by se zoom sečetl. Osa nemá nástrojovou lištu ani skok na
rok, gesta je nahradila.

**Setrvačnost.** Po švihnutí prstem posun plynule dojede (`INERTIA_TAU`,
exponenciální útlum, zastaví se pod `INERTIA_MIN_SPEED`). Rychlost se počítá
z posledních pohybů vyhlazeným průměrem; po delší pauze prstu se zapomene, aby
zastavený prst nespustil doběh. Doběh ruší cokoli dalšího — dotyk, kolečko,
gesto — a zastaví se i na kraji rozsahu, kde by běžel naprázdno.

Čas se bere z `performance.now()`, **ne z `event.timeStamp`**. Safari u dotykových
pointer událostí neručí za společnou epochu; s `timeStamp` vycházely nesmyslné
prodlevy mezi pohyby, rychlost se pořád zahazovala a na iPadu se doběh nikdy
nespustil.

**Gesto se zamyká na převládající směr.** Vodorovné švihnutí na trackpadu nese
i drobné `deltaY`. Bez zámku osa při posunu poskakovala svisle a řádky se zdály
přeskakovat — přitom řádkování je při posunu prokazatelně stabilní (pakuje se
v pixelech, které se posunou všechny stejně; mění ho až zoom).

**Kreslí se v jedné trvalé rAF smyčce** se značkou „je co překreslit"
(`dirtyRef`). Zakládat a rušit snímek v efektu při každé změně stavu bylo na
dotykových zařízeních znát.

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

**Štítky určují pásmo na ose.** Rozvržení zná `velmoc`, `udalost`, `kniha`,
`zivot`, `vlada-juda`, `vlada-izrael` a `vlada-12kmenu`; ostatní štítky
(`kral`, `narozeni`, …) jsou jen popisné. Záznam bez známého štítku spadne do
pásma „Ostatní" — nový záznam proto vždycky otaguj.

## Nasazení

Netlify staví z větve `main`. Proměnné `VITE_SUPABASE_URL` a
`VITE_SUPABASE_ANON_KEY` se **zapékají do buildu**, takže po jejich změně je
nutný nový deploy. `netlify.toml` je vyjímá ze skenování tajemství
(`SECRETS_SCAN_OMIT_KEYS`) — bez toho build spadne, protože veřejný anon klíč
z podstaty věci skončí v klientském bundlu.

`netlify/functions/udrzet-vzhuru.mjs` je naplánovaná funkce (`@daily`), která
jednou denně přečte jeden řádek z `events`. Supabase na free tieru uspí projekt
po sedmi dnech bez provozu a aplikace se ptá jen když ji někdo otevře. Funkce
běží na stejných proměnných jako aplikace; když se přejde na placený tarif, dá
se smazat.

## Kontext projektu

Stav projektu, dosavadní rozhodnutí a co je rozdělané je v
[`docs/kontext-projektu.md`](docs/kontext-projektu.md). Setup Supabase a Netlify
je v [`README.md`](README.md).
