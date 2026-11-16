# Plán rozvoje — co je hotové, co čeká a v jakém pořadí

Stav k 16. listopadu 2026. Navazuje na rozbor celého projektu (stav, audit dat,
návrh rodinných vazeb, další návrhy), který si zadavatel vyžádal před další
etapou. Tenhle soubor je jeho pracovní výtah: **co z něj už existuje, co čeká
na rozhodnutí zadavatele a co je další na řadě.** Jak věci fungují, popisuje
`CLAUDE.md`; proč se rozhodlo tak, jak se rozhodlo, `kontext-projektu.md`.

Pravidla, která pro všechno níž platí:

- U dat se **nerozhoduje za zadavatele**. Kde si záznamy odporují, ukázat a
  zeptat se.
- Vazby a údaje se opírají o Bibli a publikace z jw.org se zdrojem. Nic se
  nedomýšlí. Texty publikací musí dodat zadavatel, prostředí se na jw.org
  nedostane.
- Před hromadnou úpravou dat pustit zálohu (viz `CLAUDE.md`, Záloha dat).

## 1. Hotovo v listopadu 2026

| | |
|---|---|
| Záloha dat | denně do větve `zaloha-dat`, skript `scripts/zaloha.mjs` |
| Osoby a vazby | tabulky `persons`, `person_events`, `relations`; 191 osob, 256 vazeb, 66 propojení se záznamy osy |
| Sekce Rodokmen | strom s páteří, rozbalování větví, hledání osob, zvýraznění králů a velekněží, panel osoby, úprava zdroje / jistoty / ověření vazby |
| Propojení s osou | „Ukázat na ose“ z panelu osoby, sekce „Rodina“ a „Ukázat v rodokmenu“ v detailu záznamu |

Co v databázi z rodokmenu je: Adam → Abraham (1Mo 5 a 11), Abraham → David
(manželky, Jákobových třináct dětí, Juda → … → David podle Rt 4:18–22, Levi →
Kehat → Amram → Mojžíš, Áron, Miriam), Davidovy manželky a synové, judští
králové s matkami, Šealtiel / Pedajáš / Zerubbabel, Matoušova linie k Josefovi,
Lukášova linie přes Natana k Marii, Ježíš a jeho bratři, Zecharjáš + Alžběta →
Jan Křtitel.

## 2. Co čeká na zadavatele

### Ověřit vazby

Všech 256 vazeb je `verified = false`, takže rodokmen vidí jen přihlášený.
Ověřuje se v panelu osoby: zatržítko u vazby ji označí jako ověřenou, tužka
otevře úpravu zdroje, jistoty a poznámky. Lišta nad stromem ukazuje postup
(„Ověřeno 12 z 256 vazeb“). Jakmile je ověřená první vazba, začne se rodokmen
nabízet i nepřihlášeným — a uvidí z něj jen ověřenou část.

Na co se při ověřování zaměřit:

- **33 vazeb má jako zdroj jen plakát** „Slíbené potomstvo“ (PDF). Jde hlavně
  o matky judských králů a Lukášovu linii. Potřebují verš nebo publikaci.
- **4 sporné vazby** (`certainty = sporne`): Arpakšad → Šela (Lk 3:36 vkládá
  Kainana), Šealtiel (Jehojakin podle Mt 1:12 × Neri podle Lk 3:27),
  Zerubbabel (Šealtiel × Pedajáš podle 1Pa 3:19). Výklad rozdílu se nedoplňoval;
  chce to text hesel **it „Kainan“** a **it „Rodokmen Ježíše Krista“**.
- **3 odvozené vazby** (`odvozeno`), mimo jiné Heli → Marie.
- **Čísla veršů** se psala bez přístupu k textu nwt. Zadavatel dodal odkazy na
  1Mo 4, 5, 10 a 11, ale prostředí je neotevře — zkontrolovat ručně.

### Potvrdit páteř

Hlavní linie teď vede **královskou linií podle Matouše** (přes Šalomouna a
Josefa, Ježíš pod Josefem jako pěstounem). Lukášova linie přes Natana k Marii
je boční větev. Jestli má páteř vést jinudy, stačí přepsat `persons.spine`.

### Rozhodnout nálezy z auditu

Nic z toho se neopravovalo. První čtyři můžou čtenáře osy zmást nejvíc.

| # | Závažnost | Nález |
|---|---|---|
| 1 | vysoká | **Název odporuje vlastní poznámce.** Pruh „Období 430 let v Egyptě“ vede od roku 1943 př. n. l., jeho poznámka ale cituje it „Exodus“, že Izraelité žili v Egyptě 215 let (1728–1513); příchod Jákobovy rodiny je v ose zvlášť v roce 1728. |
| 2 | vysoká | **Žeň začíná dvakrát.** „Konec období růstu a začátek žně“ v roce 1914 (kr 1. kap.) a „Začíná žeň – sklízení úrody země“ v roce 1919 (kr 9. kap.). Obojí je citace; jestli jde o dvě věci, musí to říct název nebo poznámka. |
| 3 | vysoká | **Jednotné království je vedené jako Juda.** Saul, David a Šalomoun leží v pásmu „Vláda – jižní judské království“, rozdělení království má osa až v roce 997. |
| 4 | vysoká | **Konce velmocí jsou dopočítané, ne ze zdroje.** wcg uvádí nástupy; konce vznikly z nástupu další velmoci. Poslední velmoc nemá zdroj žádný. (7 pruhů) |
| 5 | střední | **21 záznamů nemá pořádný zdroj.** 10× „xxx“, 6× prázdno, holé „it“, „si“, „rr“ bez hesla, „Podle tradice – najít v publikaci“ (Pavlovo obrácení), „přesný den jiné články“ (Ježíš umírá). Nejvíc kolem Daniela a proroctví o týdnech. |
| 6 | střední | **Jeden okamžik, dvě tvrzení o jistotě.** Kde jedna vláda končí a druhá začíná, má jedna strana vlnovku a druhá ne: Jehošafat 913 / Jehoram ~913, Atalja ~898 / Jehoaš 898, u velmocí 874, 332, 63, 1763. |
| 7 | střední | **Křest Ježíše je „~29“**, ale „62 týdnů“ v roce 29 končí a „Jeden týden“ začíná bez vlnovky. |
| 8 | střední | **Vlády kratší než rok nejsou vidět.** Zimri, Šallum a Jehoachaz mají nulovou délku a soused je překryje; Jehojakin (taky 3 měsíce) zabírá celý rok. Nulovou délku mají i pruhy knih 3Mo, 5Mo, Ag. |
| 9 | střední | **Pět pruhů shrnuje víc lidí jako jeden „život“**, např. „Noemi, Rut, Debora, Barak, Jael, Gideon, Samson, Jefta a jeho dcera“ na 330 let. |
| 10 | střední | **Tatáž událost víckrát** (asi 20 záznamů na 8 místech): zrození Království 1914, Matoušovo evangelium ~41, dokončení Bible ~98, Řecká písma 1950, úplný překlad 1961, Russellova cesta 1880, Fotodrama 1914, Gilead 1943. |
| 11 | střední | **Století zapsané jako život.** Raab, Samuel, Eliša, Ester, Nehemjáš, Daniel a další mají přesně 100 let s vlnovkou na obou koncích. |
| 12 | střední | **Vlnovka a přesný den zároveň.** „Židé ve vyhnanství“ od „~1. října 607“ do „~1. října 537“. |
| 13 | nízká | Štítek nesedí k umístění: „Jonáš prorokuje“ (bod se štítkem období), „Jeroným překládá Vulgátu“ (událost mezi životy). |
| 14 | nízká | Lamek má jako jediný z linie vlnovku u úmrtí („~2375“), i když 3152 − 777 dává 2375 přesně. |
| 15 | nízká | Serug má jako zdroj heslo it „Reu“ — vypadá to na zkopírovaný řádek. |
| 16 | nízká | C. T. Russell: život končí „1916“ bez dne a nemá zdroj, vedle je událost s přesným dnem. |
| 17 | nízká | Zkratky Na a Ná (Nahum, Nářky) se pletou. |
| 18 | nízká | 15 rozsahů leží mezi body nad osou (knihy s rozmezím dokončení); kreslí se jako bod. |
| 19 | nízká | Období nepokrývají novodobou část — 251 záznamů od roku 1850 leží mimo jakékoli období. |
| 20 | nízká | Drobnosti zápisu: „Dřívější názor“ rozlišený jen slovy v názvu, “Obětování” Izáka má anglické uvozovky. |

V pořádku: žádné duplicity ani konec před začátkem, judské (23) i izraelské
(21) vlády navazují bez mezer, všech 66 knih má „dokončeno“, linie Adam →
Abraham sedí na 1Mo 5 a 11 ve všech 20 generacích.

### Drobnosti z dřívějška

- Pořadí odkazů wcg (`docid` 1102025962 / 964 / 966 ↔ tři části knihy) —
  potvrzený je jen prostřední.
- Jestli zaktivnit i zmínky it „Chronologie“ uvnitř poznámek.
- Jestli zkrátit „zahrnuté období“ a zahodit 📖 v názvech knih.
- Vlastní ikona stránky, pokud ji zadavatel chce.

## 3. Co zbývá v rodokmenu

Seřazeno podle užitku.

1. **Zakládání a úprava osob a vazeb z aplikace.** Teď jde měnit jen zdroj,
   jistota, poznámka a ověření; nová osoba nebo vazba se zapisuje přes SQL.
   Potřeba: formulář osoby (jméno, rozlišovač, jiné podoby, pohlaví, role,
   páteř), přidání vazby z panelu osoby, propojení osoby se záznamem osy.
   K tomu `GRANT`y a RLS už jsou.
2. **Hromadné ověřování.** Seznam vazeb jako tabulka s filtrem „neověřené“,
   „jen plakát“, „sporné“ — po jedné v panelu je to 256 klepnutí.
3. **Rodokmen v exportu a importu.** `Dataset` osoby nezná; do té doby je
   jedinou kopií větev `zaloha-dat`. Zvýšit `EXPORT_SCHEMA_VERSION`.
4. **Sporné vazby vedle sebe.** Druhý rodič je dnes vidět jen v panelu.
   Zamýšlený přepínač „podle Matouše / podle Lukáše“ by měnil hlavního rodiče.
5. **Další osoby z plakátu**: velekněží po Eleazarovi, soudci, kmeny. Role
   `soudce` a `prorok` jsou v kódu připravené, v datech zatím nejsou.
6. **Manželky ve stromu.** Kdo nemá známé rodiče ani děti, je jen v panelu.
7. **Zmenšení stromu** (přehled celku). Rozbalený strom má 3600 × 6300 px.
8. Druhý strom (Zecharjáš → Jan Křtitel) stojí vedle Adama v první řadě;
   s časem nesouvisí. Příbuzenství Alžběty a Marie v datech není.
9. Hledání v hlavičce najde jen záznamy osy, osoby má vlastní pole v rodokmenu.

Původně zvažovaný pohled „Rodová linie“ (generace jako schody na časové ose)
se **nestaví** — viz `kontext-projektu.md`. Kdyby se k němu někdo vracel, dává
smysl jen pro jednu linii bez větvení, jako doplněk, ne náhrada stromu.

## 4. Další návrhy

Náročnost: malá = jedno sezení, střední = dvě až tři.

| | Návrh | Proč | Náročnost | Stav |
|---|---|---|---|---|
| A | Automatická záloha dat | jediná kopie dat byla v Supabase | malá | **hotovo** |
| B | Skok na období — řada tlačítek, která osu přiblíží na dané období | 29 % osy (100–1850 n. l.) je prázdných, biblická část je zmáčknutá; období chybí pro novodobou část | malá | čeká |
| C | Husté roky: štítek „+6“ se seznamem schovaných záznamů | v roce 1914 je 9 bodů, v roce 33 osm; nad osu se vejde 7 řad | střední | čeká |
| D | Chytřejší hledání: i poznámky a zdroje, u knih zkratka i plný název | po zkrácení názvů knih hledání „Mojžíšova“ nenajde nic | malá | čeká |
| E | Odkaz na místo v ose (adresa nese výřez a otevřený záznam) | nejde poslat „koukni sem“ | malá až střední | čeká |
| F | Kdo žil současně: ztlumit, co se s vybraným životem nepřekrývá | nejčastější otázka u časové osy, data na ni už odpověď mají | malá až střední | čeká |
| G | Detail jako boční panel na počítači | poznámky mají až 824 znaků, bublina 300 px; rodokmen už panel má a dá se sjednotit | střední | čeká |
| H | Kontrola dat v aplikaci (záznamy bez zdroje, nulové délky, nesedící hranice) | audit zastará s prvním novým záznamem | střední | čeká |
| I | Drobné úklidy | viz níž | malá | čeká |

**I · drobné úklidy:** stav „trvá dosud“ místo „min. 2026“ (Británie a
Amerika se jinak musí každý rok přepisovat); testy pouštět před nasazením
(Netlify jen staví, rozbitá logika by prošla na web); staré datové soubory a
převodní skript wcg do archivu (nový import by přepsal zdroje s odkazy zpátky
na holé „wcg“); v Supabase zapnout kontrolu uniklých hesel a sloučit zdvojené
pravidlo čtení u štítků; pole místo a souřadnice schovat, dokud nebude mapa
(nemá je ani jeden záznam).

Nenavrhuje se: mapa, registrace dalších uživatelů, přetahování záznamů myší.

## 5. Doporučené pořadí

1. Zadavatel ověří první vazby a potvrdí páteř (část 2) — tím se rodokmen
   otevře veřejnosti.
2. Rozhodnutí k nálezům 1–4 z auditu a doplnění zdrojů; opravy podle nich.
3. Drobné úklidy (I) a chytřejší hledání (D).
4. Skok na období (B).
5. Zakládání osob a vazeb z aplikace, hromadné ověřování, export (část 3,
   body 1–3).
6. Odkaz na místo (E) a boční panel (G).
7. Husté roky (C), současníci (F), kontrola dat (H) — na sobě nezávislé.
