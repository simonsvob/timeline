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
spuštěním aplikace. Výjimka je `src/data/repository.test.ts`, který si
podstrčí falešného Supabase klienta kvůli opakování čtení.

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

**Hranice se čtou jako začátky.** Rozsah 1107–1037 sahá od začátku roku 1107
do začátku roku 1037 a bod leží na začátku svého roku, ne uprostřed. Kdyby
rozsah zabíral i celý koncový rok, navazující vlády by se o rok překrývaly.
Délka pruhu tak odpovídá tomu, co hlásí `rangeLengthYears`.

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

Pohledy jsou tři — osa, tabulka a rodokmen (viz „Rodokmen — osoby a vazby“
níž). Přepíná je `App`, který každému drží i jeho stav přes přepnutí.

**Model „Řeka".** Osa je jedna vodorovná čára uprostřed plochy. Kolem ní leží
**pásma** — vodorovné pruhy plochy s vlastním řádkováním, vybraná umístěním
záznamu (`placement`). `lane` 0 je řádek nejblíž čáře; hotovou svislou polohu i výšku tvaru
nese každá položka sama (`centerY`, `height`, záporné = nad čárou), vykreslení
si ji nepočítá.

Pilulek se nad čáru vejde jen `MAX_POINT_LANES` řádků. Co se nevejde, ztratí
pilulku (`labelMode: 'none'`) a zůstane jen uzlem na čáře — jinak by při
oddálení pilulky vytlačily osu mimo obrazovku.

**Pásma jsou v `BANDS` v `layout.ts`** — jediné místo, kde se mění pořadí.
`band.id` je zároveň hodnota `placement` na záznamu, takže volba ve formuláři
a pásmo na ose jsou jedno a totéž. Shora dolů:

| `placement` | Pásmo | Kde | Tvar | Řada |
|---|---|---|---|---|
| `velmoci` | Světové velmoci | připnuto nahoře | pruhy | jedna |
| `udalosti` | Body nad osou | plave nad čárou | pilulky | řádkuje se |
| | — *centrální čára* — | | | |
| `zivoty` | Rozsahy pod osou | plave pod čárou | pruhy | řádkuje se |
| `knihy` | Knihy – zahrnuté období | plave pod čárou | pruhy | řádkuje se |
| `izrael` | Vláda – sev. izraelské království | připnuto dole | pruhy | jedna |
| `juda` | Vláda – již. judské království | připnuto dole | pruhy | jedna |

Seznam umístění je **pevný**, protože ke každé hodnotě patří i kus vykreslení
(připnutý pás, jedna řada, tvar) — nedá se zakládat z aplikace jako štítek.
Neznámé umístění (starší data, cizí import) spadne mezi rozsahy pod osou
(`DEFAULT_PLACEMENT`), nikdy nezmizí. Prázdný formulář naopak startuje na
`NEW_EVENT_PLACEMENT` (`udalosti`) — nový záznam je bod a bod patří nad osu.

**Následující pásmo navazuje na řádky obsazené ve výřezu**, ne na všechny.
Rozsahy se řádkují přes celé dějiny; kdyby se knihy skládaly za jejich plný
`laneCount`, ležely by o desítky řádků pod posledním pruhem, který je zrovna
vidět. Svislá poloha čáry se ale počítá z **nejhoršího případu**
(`worstCaseEdge`) — kdyby se odvíjela od viditelných řádků, čára by při posunu
poskakovala nahoru a dolů. Když se obsah nevejde, dostane prostor nad čárou
nejvýš `ABOVE_SHARE` volné plochy: sedm řad pilulek by jinak vytlačilo rozsahy
mimo obrazovku.

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
se odliší **střídavým odstínem** (`shade`), ne mezerou. Zaoblení mají stejné
jako životy, jen menší minimální šířku (`MIN_SEGMENT_WIDTH`) — široké minimum
by krátké vlády roztáhlo přes sousedy.

Názvy pásem jsou v `cs.timeline.bands`; na plátně se kreslí do mezery nad
pásmem, jen u pásem na jedné řadě — u ostatních se řada pozná z obsahu.

**Umístění, štítek, kategorie — tři různé věci.** Slévat je zpátky dohromady
je ta chyba, kvůli které se to předělávalo:

| | Co říká | Kdo ji vybírá | Co dělá |
|---|---|---|---|
| umístění (`placement`) | KDE záznam je | pevný seznam v kódu | pásmo na ose |
| štítek (`tagId`) | CO záznam je | zakládá se v aplikaci | barvu záznamu |
| kategorie | KDY se něco dělo | zakládá se v aplikaci | barví osu a minimapu |

Kategorie s vyplněným `fromYear`/`toYear` se chová jako časové období: barví
centrální čáru (plynulý gradient přes období ve výřezu) a dráhu minimapy.
Na barvu záznamů **nemá vliv** — tu nese výhradně štítek (`tagColor`);
záznam bez štítku dostane `NO_TAG_COLOR`. Barva tak znamená druh záznamu
(životy modře, knihy fialově, velmoci zeleně…), ne dobu.

Záznam má nejvýš **jeden** štítek. Štítky (`TagSection`) i období
(`PeriodSection`) jsou sekce uvnitř modálu **Data** — sahá se na ně zřídka a
v hlavičce by jen ubíraly místo ose; obě sdílejí `ColorPicker` a obě mění data
jen po přihlášení (`canEdit`). Filtrování na štítcích nestojí: tlačítko
**Filtr** v hlavičce otevře bublinu (`BandFilter`), která zapíná a vypíná
**pásma**. Stav filtru drží `App`, protože tlačítko je v hlavičce, ale filtruje
obsah osy.

**Hlavička drží na každé šířce jeden řádek** — co si vezme na výšku, chybí
ose. Ovládací prvky mají jednotnou výšku `--touch`, takže výšku hlavičky určuje
jen ona a svislý okraj (na telefonu 54 px, na počítači 59 px). Hledání, filtr,
nápověda (modál Data) a zámek jsou kulatá tlačítka s ikonou (`.icon-button`,
ikony v `components/icons.tsx`). Pod 900 px se pole hledání schová do tlačítka
a po klepnutí se rozbalí přes celý řádek — `flushSync` v `SearchBox` je tam
proto, že Safari na iOS ukáže klávesnici jen pro focus přímo z klepnutí. Pod
640 px zmizí název aplikace a rozsah let a bublina filtru se ukotví k hlavičce,
ne k tlačítku: od tlačítka vpravo by vyjela z displeje. Zapnutý filtr ukazuje
tečka v rohu tlačítka.

**Poloha na ose přežívá přepnutí do tabulky.** Výřez i svislý posun čáry drží
`App` (`TimelineViewState`), ne `TimelineView` — přepnutí pohledu osu odpojí a
s ní by zmizel i výřez, takže návrat by pokaždé skončil na celém rozsahu.
Je to `ref`, ne stav: mění se při každém snímku posunu a překreslovat kvůli
tomu hlavičku nemá smysl. `TimelineView` si polohu přečte jen při připojení a
ořízne ji na aktuální rozsah dat (mezitím mohl někdo záznam smazat). Ze stejného
důvodu je skok na záznam z hledání a z tabulky **jednorázový** — `App` ho po
provedení zahodí, jinak by ho návrat z tabulky zopakoval a odnesl uživatele
pryč z místa, kde byl.

**Zdroj a poznámka umí odkazy.** Zápis je markdownový — `[wcg](https://…)`
udělá z „wcg" klikací text, samotná adresa v textu se zaktivní taky. Rozpoznání
je v `src/lib/links.ts` (čistá funkce, testy), vykreslení v `components/RichText.tsx`;
používá ho detail záznamu i sloupec zdroje v tabulce. **Pouští se jen `http`
a `https`** — `javascript:` a `data:` zůstanou obyčejným textem. Text sice píše
přihlášený uživatel, ale čte ho kdokoli, takže se s ním nakládá jako s cizím
vstupem. Na plátno se zdroj ani poznámka nekreslí, proto tam odkazy nejsou.
V tabulce klik na odkaz nesmí probublat na řádek, který otevírá formulář
(`stopPropagation`).

Barva štítku se na ose projeví u pruhů výplní a obrysem, u pilulek nad osou
náznakem výplně, obrysem, stínem a jménem — plná výplň by z pilulky udělala
skvrnu, roky proto zůstávají tlumené.

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
- **Řádkuje se v `packX1`/`packX2`, ne v `x1`/`x2`.** Pakovací souřadnice je
  `rok × pxPerYear` bez `t0`, takže na posunu vůbec nezávisí. S obyčejnými
  pixely plátna se zaokrouhlení s posunem měnilo a položky se stejným
  začátkem si přehazovaly řádky — projevovalo se to problikáváním apoštolů
  kolem přelomu letopočtu. Ze stejného důvodu se pořadí kreslení řadí podle
  délky v letech, ne podle pixelové šířky.
- Do obsazeného místa se počítá i šířka popisku. Když by řádků bylo přes
  `MAX_LANES_WITH_LABELS`, přepne se do zhuštěného režimu a popisky, které se
  nevejdou, se skryjí (ukážou se po najetí a v detailu).
- Měření textu je cachované podle řetězce (`measureText` v `TimelineCanvas.tsx`);
  při změně fontu je potřeba cache zneplatnit.
- Popisek degraduje podle místa (`LabelMode`): jméno + roky uvnitř → jen jméno
  uvnitř → vedle pruhu → nic. Řádkování počítá s reálnou šířkou popisku.
- Jméno na pruhu nese barvu štítku ztmavenou o 42 % (`darken`), roky tutéž
  barvu poloprůhlednou. Neutrální černá se nepoužívá — text má patřit k pruhu.

**Gesta.** Přibližuje jen pinch, samotné kolečko posouvá. Pinch chodí do
aplikace **dvěma různými cestami** a obě je potřeba obsluhovat: Chrome a Firefox
posílají `wheel` s `ctrlKey`, Safari (Mac i iPad) vlastní `gesturestart` /
`gesturechange` / `gestureend`, kde `scale` je poměr vůči začátku gesta, ne
přírůstek. Na iPadu navíc Safari posílá gesta souběžně s dotyky, které řeší
pinch přes pointery — proto se obsluha gest přeskakuje, jakmile je na plátně
**jediný** aktivní ukazatel. Hlídat až dva nestačilo: `gesturestart` umí přijít
dřív než druhý `pointerdown` a v té skulině se zoom sčítal dvakrát. Na trackpadu
Macu žádný ukazatel není, do mapy se zapisuje až při `pointerdown`. Osa nemá
nástrojovou lištu ani skok na rok, gesta je nahradila.

**Pinch i odkládání gest počítají jen prsty**, ne myš (`touch` v mapě
ukazatelů). Na iPadu s Magic Keyboard je kurzor trackpadu na plátně současně
s prsty; kdyby se počítal, spároval by se s prstem do pinche. Ukazatel, kterému
nepřišel `pointerup`, uklidí `onLostPointerCapture`.

**Sevření prstů na trackpadu iPadu se chytit nedá.** Safari ho stránce nepředá —
žádný `wheel`, `gesture*` ani pointer — a místo toho přiblíží celou stránku
navzdory `user-scalable=no`. Hlášené od roku 2020, stejně na tom jsou Miro a
spol. Proto existuje **ovládání klávesnicí**: `+`/`−` zoom, šipky posun
(`keyNudge` ve `viewport.ts`, testy). Bere se `event.key`, ne `event.code`,
kvůli české klávesnici. Stisk se nesčítá skokem, ale přičte se ke zbývajícímu
pohybu, který dojíždí s `KEY_EASE_MS` — podržená klávesa tak jede plynule.
Klávesy se ignorují v polích formuláře, při otevřeném modálu a s ⌘/Ctrl/Alt
(to je zoom prohlížeče). Nápověda k ovládání je první sekcí modálu Data.

**Setrvačnost.** Po švihnutí prstem posun plynule dojede (`INERTIA_TAU`,
exponenciální útlum, zastaví se pod `INERTIA_MIN_SPEED`). Rychlost se počítá
z posledních pohybů vyhlazeným průměrem; po delší pauze prstu se zapomene, aby
zastavený prst nespustil doběh. Doběh ruší cokoli dalšího — dotyk, kolečko,
gesto — a zastaví se i na kraji rozsahu, kde by běžel naprázdno.

Čas se bere z `performance.now()`, **ne z `event.timeStamp`**. Safari u dotykových
pointer událostí neručí za společnou epochu; s `timeStamp` vycházely nesmyslné
prodlevy mezi pohyby, rychlost se pořád zahazovala a na iPadu se doběh nikdy
nespustil.

**Zoom má strop na rychlosti — ale jen na trackpadu** (`limitZoomFactor` ve
`viewport.ts`). Trackpad Macu posílá při rychlém pinchi velké `deltaY` a po
dojetí prstů ještě dávku setrvačných událostí; exponenciální zoom to složil
dohromady a měřítko přeletělo půlku rozsahu, než člověk stihl zareagovat.
Strop je v e-násobcích za sekundu (`MAX_ZOOM_RATE`), takže na počtu událostí
nezáleží — plný rozsah se přejede zhruba za tři vteřiny.

**Dotykový pinch se stropem omezovat nesmí.** Vzdálenost prstů JE požadované
měřítko, žádná setrvačnost tam není a strop ho jen držel zpátky: při 60
událostech za vteřinu vycházel limit na ~1,06× za snímek, což běžný pinch
překročí, takže se zoom za prsty opožďoval a trhal. Pinch přes pointery proto
používá poměr vzdáleností přímo. Samotná matematika zoomu je čistě geometrická,
žádný skok v ní není.

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

## Rodokmen — osoby a vazby

Třetí pohled vedle Osy a Tabulky. **Čáry mezi příbuznými se do osy nekreslí** —
pruhy se tam řadí podle volného místa, ne podle příbuzenství, a spojnice by se
křížily přes celou plochu. Rodokmen je samostatná sekce a s osou ho pojí jen
proklik oběma směry („Ukázat na ose“ / „Ukázat v rodokmenu“) a sekce **Rodina**
v detailu záznamu.

**Osoba není záznam osy.** David má na ose život i vládu, pruh „Daniel,
Chananjáš, Mišael, Azarjáš“ jsou čtyři lidé a většina osob rodokmenu na ose
není vůbec. Proto tři tabulky nad stávajícími záznamy, na které se nesahá:

| Tabulka | Co drží |
|---|---|
| `persons` | jméno, rozlišovač stejnojmenných (`qualifier`), jiné podoby jména (`alt_names`), pohlaví, role (`kral`, `veleknez`…), příznak páteře (`spine`) |
| `person_events` | který záznam osy k osobě patří a v jaké roli (`zivot` / `vlada` / `zminka`) |
| `relations` | kdo ke komu: `rodic`, `pestoun`, `predek` (zdroj generace vynechává), `manzelstvi`; k tomu jistota, zdroj, poznámka, ověření a pořadí dítěte |

Sourozenci, prarodiče a vnuci se **neukládají**, počítají se z rodičů
(`relativesOf`). U `rodic`/`pestoun`/`predek` je `from_person` rodič a
`to_person` dítě.

**Jistota a ověření jsou dvě různé věci.** `certainty` říká, co tvrdí zdroj
(`vyslovne` / `odvozeno` / `sporne`), a kreslí se druhem čáry. `verified`
říká, že vazbu **člověk** zkontroloval proti Bibli nebo publikaci. Neověřené
vazby vidí jen přihlášený (`buildKinIndex(…, { includeUnverified: canEdit })`
v `App`); dokud není ověřená žádná, nepřihlášenému se přepínač Rodokmen vůbec
nenabídne. Zadavatel chce mít vazby opřené o Bibli a publikace z jw.org —
**nic nedomýšlej**, a co nejde doložit, ulož jako neověřené se zdrojem, ze
kterého to je.

**Logika je v `src/lib/genealogy.ts`** (čistá, s testy), kreslí
`components/GenealogyView.tsx`:

- **Strom, i když data strom nejsou.** Dítě má dva rodiče a prameny se někdy
  liší (Šealtiel je podle Matouše syn Jehojakina, podle Lukáše Neriho). Každá
  osoba visí pod jedním *hlavním* rodičem (`primaryParentRelation`): osoba na
  páteři pod rodičem na páteři, jinak pod otcem. To je kostra (`TreeNode`).
  Druhý rodič a manželství jsou čáry navíc (`TreeLink`).
- **Řady nejsou generace od Adama.** Dítě stojí pod *všemi* rodiči a manželé
  vedle sebe, takže se kratší linie natáhne: Marie má podle Lukáše víc předků
  než Josef podle Matouše, a aby stáli vedle sebe nad Ježíšem, dostane Josef
  delší čáru od otce. Řady se dopočítávají opakovaným posouváním dolů; strop
  průchodů a kontrola předků hlídají data, která by se honila dokola.
- **Manželky bez známých rodičů se přisazují vedle manžela** (`attachedTo`),
  stejně tak matka bez zapsaného manželství (Tamar u Judy). Děti k matce
  přisazené vedle otce čáru nemají — říká to sousedství a po klepnutí na osobu
  se její nejbližší rodina ve stromu zvýrazní. Dvanáct čar k Jákobovým synům
  by strom zahltilo.
- **Všechno je rozbalené**, sbalit jde jednotlivé větve (`collapsed`) nebo
  všechny naráz. Původně to bylo obráceně a zadavatel to odmítl: rodokmen chce
  vidět celý, souvislosti se ze sbaleného stromu nepoznají. Sbalená větev
  ukazuje jen páteř a řady jedináčků.
- **Páteř je svislice, větve se k ní přisazují obrysem** (`placeSpine`):
  sourozenci před potomkem na páteři doleva, ostatní doprava, každá větev tak
  těsně, jak dovolí to, co už v dotčených řadách stojí. Páteř i s manželkami se
  rozmístí celá napřed, jinak by jí hluboká větev shora zalehla místo. Do
  obrysu se počítá i svislá čára natažené linie, která řadami jen prochází.
- **Karty jsou HTML nad jedním SVG**, ne Canvas: osob jsou stovky, ne tisíce.
- **Posun a zoom.** Plocha je rolovací prvek, ale kolečko a trackpad si
  obsluhuje sama (`wheel` s `preventDefault`): nativní posun prohlížeče na Macu
  zamykají na jeden směr a po stromu se nedalo „kroužit“. Zoom je CSS `scale`
  na vnitřním obalu (`.genealogy-world`), rolovaná plocha má rozměr násobený
  měřítkem. Meze `MIN_SCALE`–`MAX_SCALE`; přiblížit jde jen kousek nad
  skutečnou velikost. Pinch chodí dvěma cestami jako u osy (`wheel` + `ctrlKey`,
  `gesture*` v Safari). `zoomAt` mění DOM rovnou a stav až potom — události
  chodí rychleji, než React překresluje. **Dotykový pinch mimo Safari chybí**
  (Android); tam jsou tlačítka.
- Sbalení větve drží kartu pod prstem: její poloha se před změnou změří
  v DOM a po přepočtu se o rozdíl posune scroll. Ze souřadnic stromu to nejde,
  úzký strom je v ploše vystředěný.
- **Vzhled karet nese význam:** ženy mají oblou kartu, role (král, velekněz…)
  barevný obrys a podklad (`ROLE_COLORS`, do karty jde přes `--role`), hlavní
  linie tmavší jméno. Druh čáry říká jistotu, barva čáry ověření.
- Sbalené větve, vybranou osobu, měřítko a posun drží `App`
  (`GenealogyViewState`), stejně jako polohu osy.

**Tři pohledy se na telefonu nevejdou do hlavičky**, která se nesmí zalomit.
Pod 640 px se proto segmenty schovají a přepíná se nativním `select`
(`.switch-select`) — jen když je rodokmen k dispozici.

Z aplikace jde u vazby měnit jen zdroj, jistota, poznámka a ověření
(`updateRelation`). Osoby a vazby samotné se zatím zakládají přes SQL; export
a import je nezná (`Dataset` a `EXPORT_SCHEMA_VERSION` jsou beze změny).

## Data a Supabase

**Čtení se při přechodné chybě samo zopakuje** (`RETRY_DELAYS_MS`
v `repository.ts`). Supabase občas odmítne čerstvě obnovený token hláškou
„JWT issued at future“: token podepisuje služba `auth`, ověřuje `rest`
a hodiny obou se o zlomek vteřiny rozcházejí. V logu je vidět, že ze tří
souběžných dotazů se stejným tokenem projdou dva a třetí spadne na 401. Chyby,
které se samy nespraví (chybějící tabulka, RLS), se opakováním nezdržují a
ukážou se hned.

**Data se čtou až po obnovení přihlášení.** Supabase klient načítá uloženou
relaci z localStorage asynchronně; když se četlo hned při připojení
komponenty, první dávka dotazů odešla anonymně a po obnovení relace se
všechno stáhlo znovu — dvě kola tří dotazů čtyřicet milisekund po sobě.

Přístup jde přímo z prohlížeče přes `@supabase/supabase-js`, vlastní server
neexistuje. Zápisy hlídá RLS: `SELECT` pro `anon` i `authenticated`, zápis jen
pro `authenticated`. Migrace jsou v `supabase/migrations/`; při změně schématu
přidej migraci **a** promítni ji do `src/data/repository.ts` (seznam sloupců
`EVENT_COLUMNS` je ruční).

**Nová tabulka potřebuje `GRANT` ve stejné migraci.** Od 30. 10. 2026 Supabase
nově vzniklým tabulkám v `public` nepřiděluje práva pro Data API sám — bez
`grant` aplikace do tabulky nevidí a dostane `permission denied`. Týká se to
i zakládání od nuly (nový projekt, preview větev, `supabase db reset`), proto
`20250111000000_granty_data_api.sql` práva doplňuje i třem stávajícím tabulkám.
Vzor: `anon` jen `select`, `authenticated` a `service_role` `select, insert,
update, delete`. Práva jen otevírají dveře, o tom, kdo smí co, dál rozhoduje RLS.

Migrace se do ostré databáze pouštějí přes `apply_migration` se jménem souboru
bez data (`granty_data_api`); databáze si je eviduje pod vlastním časem.

Validační pravidla se drží na dvou místech zároveň — v `src/lib/validation.ts`
i jako CHECK constraints v migraci. Když měníš jedno, změň druhé.

Export/import má verzi schématu (`EXPORT_SCHEMA_VERSION` v `src/data/types.ts`).
Import umí načíst i starší verze; při přidání pole verzi zvyš a rozšiř
`SUPPORTED_IMPORT_VERSIONS`.

**Dva sloupce, dvě role.** `events.placement` (text, CHECK na šest známých
hodnot) rozhoduje o pásmu, `events.tag_id` → `tags` nese barvu. Sloupce
`events.category_id` i `events.keywords` padly — kategorie na záznamech
nevisí a klíčová slova nic neřídila (zbyla po době, kdy se z nich odvozovalo
pásmo). Import je z nich u starších souborů pořád umí dopočítat.

Osmý štítek `období` vznikl při importu pro záznamy, které nejsou ani událost,
ani život; kdyby přestal dávat smysl, stačí je přepsat na `událost` a štítek
smazat.

Nový záznam **vždycky** dostane štítek — bez něj bude šedivý.

**Záloha dat.** `.github/workflows/zaloha.yml` jednou denně pustí
`scripts/zaloha.mjs`, který přes REST stáhne všechny tabulky a uloží je do
větve `zaloha-dat` (`data.json`, syrové řádky ve stálém pořadí — z historie
větve je vidět, co se který den změnilo). Obnovu popisuje `README.md` v té
větvi. **Nová tabulka patří i do seznamu ve skriptu**, jinak se nezálohuje.
Před hromadnou úpravou dat se vyplatí zálohu pustit ručně (Actions → Záloha →
Run workflow).

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
[`docs/kontext-projektu.md`](docs/kontext-projektu.md). Co je naplánované, co
čeká na rozhodnutí zadavatele a nálezy z auditu dat jsou v
[`docs/plan-rozvoje.md`](docs/plan-rozvoje.md). Setup Supabase a Netlify
je v [`README.md`](README.md).

**Zadavatel neprogramuje.** Mluv s ním jako s laikem: podstatné na začátek,
stručně, bez žargonu (PR, větev, migrace se musí říct lidsky). Hotové změny se
po ověření pouštějí **rovnou do `main`** (nasadí se samy) — výslovně to tak
chce, o PR nestojí. Pak mu řekni, co se změnilo a že je to na webu.
