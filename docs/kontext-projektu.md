# Kontext projektu — pro navazující chaty

Shrnutí pro konverzaci, která na projektu pokračuje bez historie. Popisuje, co
aplikace je, jak je zapojená, co už se rozhodlo a proč, a co zbývá.

Poslední aktualizace: 16. listopadu 2026.

**Vzhled** prošel přestavbou na návrh „Řeka" (centrální čára, události nad ní,
životy pod ní). Předchozí vzhled je zazálohovaný na větvi `zaloha/design-v1`.

## O co jde

Webová aplikace pro zadávání a prohlížení biblické časové osy. Obsah si vyplňuje
uživatel sám — aplikace nic nepředvyplňuje, je to nástroj na vstup a vizualizaci.
Uživatelé: manželský pár, který si osu staví z knih. Prohlížení je veřejné,
editace po přihlášení.

Rozhraní je kompletně česky, včetně kódu a dokumentace.

## Kde to běží

| | |
|---|---|
| Repozitář | `simonsvob/timeline`, produkční větev `main` |
| Web | https://lineoftime.netlify.app (Netlify projekt `lineoftime`, staví z `main`) |
| Databáze | Supabase, projekt `zhzkbmxfitkoyitztuxh` (eu-west-1) |
| Účty | 1 sdílený účet editora, potvrzený, funkční |

Postup nastavení od nuly (migrace, RLS, účty, proměnné, deploy) je v `README.md`.

## Jak navázat v nové konverzaci

Konverzace se mezi účty nepřenášejí, ale **nic podstatného v konverzaci
nebydlí** — kontext je schválně v repozitáři. Nová session potřebuje jen tohle:

1. **Přístup k repozitáři `simonsvob/timeline`.** Tím se samo načte `CLAUDE.md`
   (jak se v projektu pracuje, časový model, architektura) a tenhle soubor
   (stav, rozhodnutí, co je rozdělané). Víc kontextu k nastartování netřeba.
2. **Konektor Supabase**, aby šlo sahat na databázi (migrace, dávkové importy,
   kontrola dat). Bez něj jde vyvíjet kód, ale ne měnit data ani schéma.
3. **Konektor Netlify** je volitelný — nasazení se pustí samo po pushnutí do
   `main`. Hodí se jen na čtení logů a proměnných.

Dobrý první příkaz do nové session: *„Přečti si `CLAUDE.md`,
`docs/kontext-projektu.md` a `docs/plan-rozvoje.md` a shrň mi, v jakém stavu
projekt je a co je rozdělané."* Odpověď rovnou ukáže, jestli kontext dosedl.

**Jak se se zadavatelem pracuje.** Neprogramuje — mluv lidsky, stručně,
podstatné na začátek. Hotové a ověřené změny chce **rovnou na ostrém webu**
(push do `main`), o PR nestojí. U dat platí: opírat se jen o Bibli a publikace
z jw.org, nic nedomýšlet, a kde si data odporují, **nerozhodovat za něj** —
ukázat a zeptat se.

Co v nové session **nebude** a je potřeba počítat s tím:

- historie, proč se něco dělalo — proto se rozhodnutí zapisují sem a do
  commit messages, ne jen do chatu;
- prostředí nemá přístup na `*.supabase.co`, `*.netlify.app` ani `jw.org`
  (síťová politika), takže se aplikace neověřuje proti ostrým datům, ale
  dočasným lokálním náhledem nad exportem dat, a texty publikací musí dodat
  zadavatel. Na databázi se dá sáhnout jen přes konektor Supabase.

**Dočasný náhled** (komponenty testy nemají, vzhled se ověřuje v prohlížeči):
složka `preview-tmp/` s vlastním `index.html` a `main.tsx` a
`vite.preview.config.ts`, který pluginem `resolveId` podvrhne `../lib/supabase`
(falešné přihlášení podle `?login`) a `../data/repository` (data z JSON přes
skutečné `…FromRow`). Řádky záznamů se vezmou přes konektor nebo z větve
`zaloha-dat`. Chromium a Playwright jsou v prostředí předinstalované. Před
commitem se náhled **maže**.

## Stav

Aplikace je hotová a nasazená. Funguje osa s plynulým zoomem, formulářová
editace, správa štítků i období (v modálu Data), filtr pásem, tabulkový
přehled, **rodokmen**, export/import a přihlášení. V databázi je
**557 záznamů**, 687 osob a 844 rodinných vazeb. Záznamy: tři časové
osy z knihy *Odvážně choď s Bohem* (str. 14–15, 104–105, 186–187), chronologie
králů, knih a událostí z hesla „Chronologie" a z dodatku nwt A6, přehled
biblických knih a dávka událostí z tabulky zadavatele. Testů 202, všechny
procházejí.

Data se jednou denně zálohují do větve `zaloha-dat` (GitHub Actions).

Ověřeno měřením, ne odhadem: 60 fps (medián 16,6 ms na snímek) při zoomu
a posunu s 3000 záznamy; RLS testována chováním pod rolemi `anon`
i `authenticated`, ne jen existencí politik.

### Co je rozdělané

- **Rodokmen je hotový jako prohlížeč, ne jako editor** (listopad 2026).
  Obsahuje celý plakát „Slíbené potomstvo“ včetně manželek a vedlejších rodin.
  Funguje celý strom (větve jdou sbalit), zoom, panel osoby, proklik na osu a
  zpět, hledání osob a úprava zdroje, jistoty a ověření u vazby. **Skoro
  všechny vazby jsou neověřené** — zadavatel je prochází a ověřuje sám;
  nepřihlášený vidí jen ověřenou část. Co chybí a v jakém pořadí, je v
  [`plan-rozvoje.md`](plan-rozvoje.md).
- **Audit dat čeká na rozhodnutí.** Dvacet nálezů v 557 záznamech, čtyři
  závažné. Nic z toho se neopravovalo — seznam je v `plan-rozvoje.md`.

- **Období jsou předběžná.** Šest kategorií (do potopy, patriarchové, soudci,
  králové, od návratu z Babylonu, od Ježíše dál) je zatím na zkoušku. Hranice
  jsou odvozené z událostí v datech a dají se změnit ve správě období.
  Barví jen osu a minimapu, na záznamy nesahají. Zadavatel si se systémem
  období chce do budoucna ještě pohrát.
- **Sada štítků.** Osm štítků: `život`, `událost`, `kniha dokončeno`,
  `kniha zahrnuto`, `velmoc`, `vláda Judsko`, `vláda Izrael`, `období`.
  Prvních sedm zadal zadavatel, `období` vzniklo při importu pro záznamy,
  které nejsou ani událost, ani život — dá se sloučit do `událost`.
- **Filtrování.** Bublina pod tlačítkem „Filtr" zapíná a vypíná pásma.
  Zadavatel chce filtry ladit později; teď nejsou priorita.
- **Zdroje s `xxx`.** Pár záznamů z dávky zadavatele má ve zdroji jen `xxx` —
  zástupný text, který se v datech nechal.
- **„JWT issued at future".** Supabase občas odmítne čerstvě obnovený token,
  protože se hodiny služeb `auth` a `rest` o zlomek vteřiny rozcházejí.
  Aplikace to teď sama zopakuje, takže se to navenek neprojeví. Kdyby to
  začalo být časté, je to na podporu Supabase — v aplikaci se to spravit nedá.
- **Priorita postav.** Do budoucna má jít postavy seřadit podle důležitosti,
  aby výš byly výraznější. Zatím řádkuje jen greedy packing podle místa.

## Rozhodnutí a proč

Tahle část je důležitější než seznam funkcí — bez ní se dřív nebo později
někdo pokusí „opravit" něco, co je záměr.

**Hranice rozsahu i bodu se čtou jako začátky.** Rozsah 1107–1037 končí na
začátku roku 1037, ne na jeho konci, a bod leží na začátku svého roku. Jinak
by se navazující vlády o rok překrývaly a bod by seděl uprostřed roku.

**Astronomické roky, ne záporné inty podle chuti.** 1 př. n. l. = 0. Rok nula
neexistuje, takže bez astronomického číslování by rozdíl mezi −1 a 1 nebyl
jeden rok. Převod je jen ve vstupní a zobrazovací vrstvě.

**Žádné JS `Date` pro historická data.** Neumí spolehlivě roky př. n. l. a
vnucuje falešnou přesnost. Celá časová logika je vlastní.

**Přesnost, jistota a otevřenost jsou tři nezávislé vlastnosti.** „607 př. n. l."
(jen rok), „~1450 př. n. l." (odhad) a „min. 64 n. l." (rok neznáme, je aspoň 64)
jsou tři různá tvrzení. Slévat je je chyba — proto má každé vlastní vykreslení:
ostrá hrana, přechod do ztracena, hrana se šipkou. Otevřenost přibyla až při
importu dat z knihy, kde bylo 10 takových záznamů.

**Vlastní vykreslení na Canvas, žádná timeline knihovna.** Žádná hotová nezvládá
kombinaci př. n. l., plynulého zoomu přes 6000 let a vykreslení nejistoty.
Canvas místo SVG kvůli překreslování celého výřezu v každém snímku.

**Jeden sdílený účet stačí.** Původně se počítalo se dvěma. Oprávnění stojí na
roli `authenticated`, ne na vlastnictví záznamů, takže na počtu účtů nezáleží
a další jde přidat kdykoli. Aplikace si u záznamů nepamatuje autora.

**Editace jen formulářem.** Na ose se záměrně nic nepřetahuje.

**Zdroj a poznámka nesou odkazy, jméno ne.** Do obou polí se dá napsat
`[wcg](https://…)` a v detailu i v tabulce z toho bude klikací „wcg" — text
odkazu je schválně nezávislý na adrese, protože zdroje se citují zkratkou.
Pouští se jen `http` a `https`. Na plátno osy se odkazy nekreslí: tam se
zobrazují jen jména a roky, a klikací text uvnitř Canvasu by znamenal vlastní
obsluhu kliknutí bez jakéhokoli zisku.

**Knihy v datech nesou zkratky.** 96 záznamů biblických knih se v srpnu
importovalo s plnými názvy (`📖 1. Mojžíšova – psaní dokončeno`). Na ose se
takový popisek do pruhu nevešel, takže se přejmenovaly na `📖 1Mo – dokončeno`
a `📖 1Mo – zahrnuté období` podle běžné české sady zkratek. Přípona zůstala,
aby se dvojice záznamů (dokončení psaní × zahrnuté období) rozeznala i
v tabulce, kde chybí pásmo.

**Osa si pamatuje, kde uživatel byl.** Výřez a svislý posun čáry drží `App`,
takže přepnutí na tabulku a zpátky vrátí stejné místo a stejné přiblížení —
jinak by se osa pokaždé oddálila na celý rozsah a místo by se muselo hledat
znovu. Skok na záznam z hledání a z tabulky se proto provede jen jednou; kdyby
zůstal viset, návrat z tabulky by uživatele pokaždé odnesl zpátky na naposledy
hledaný záznam.

**Osa nemá nástrojovou lištu.** Skok na rok, tlačítka zoomu ani „celý rozsah"
tam nejsou — pinch a tažení to zvládnou rychleji a lišta jen ubírala místo.
Hledání se přesunulo do hlavičky, přihlášení je jen ikona zámku. Filtr
a Data (teď „Nápověda a data") jsou taky kulatá tlačítka s ikonou a hlavička
drží na každé šířce jeden řádek — na telefonu dřív zabrala čtvrtinu displeje.

**Klávesnice jako náhrada za pinch na iPadu.** Kamarád zadavatele na iPadu
s Magic Keyboard nezazoomoval vůbec: Safari sevření prstů na trackpadu stránce
nepředá a přiblíží celou stránku. To se obejít nedá, proto přibylo ovládání
klávesami `+`, `−` a šipkami. Jestli teď s připojenou klávesnicí funguje
i pinch prsty na displeji, zatím nikdo neověřil na skutečném iPadu — v náhledu
v Chromiu ano.

**Body nahoře, rozsahy dole.** Bodové záznamy mají vlastní pásmo nahoře
a kreslí se jako svislé značky s pilulkou. Rozházené mezi pruhy se ztrácely
a kolečka se s pruhy pletla.

**Pásmo knih navazuje na to, co je vidět.** Rozsahy se řádkují přes celé
dějiny, takže pásmo knih leželo o desítky řádků pod posledním pruhem ve
výřezu. Následující pásmo se proto skládá za řádky obsazené **ve výřezu**.
Svislá poloha čáry se ale pořád počítá z nejhoršího případu — kdyby se
odvíjela od viditelných řádků, čára by při posunu poskakovala.

**Pásma podle umístění, ne dvě pevná pásma.** Osa je rozdělená na pásma
(`BANDS` v `layout.ts`), shora dolů: světové velmoci, body nad osou, čára,
rozsahy pod osou, zahrnutá období knih, severní izraelské království, jižní
judské království. Judské
a izraelské království vládly současně — v jednom pásmu by je řádkování
promíchalo a nešlo by odečíst, kdo vládl souběžně s kým. Pásmo bez záznamů
nebo skryté nezabírá žádné svislé místo.

**Umístění, štítek a období jsou tři různé věci.** Původně se to slévalo:
kategorie znamenala období (barvu podle toho KDY) a zároveň dávala barvu
záznamu, a o pásmu rozhodovala textová pole štítků, do kterých se muselo
trefit jméno, které znal jen kód. Bylo to naruby a bez obojího vyplněného se
záznam vůbec neukázal. Nově:

- **umístění** říká KDE záznam je → pásmo na ose. Pevný seznam v kódu, protože
  ke každé hodnotě patří i kus vykreslení (připnutý pás, jedna řada, tvar).
- **štítek** říká CO záznam je → jeho barva. Zakládá se v aplikaci, záznam má
  nejvýš jeden. Barva tak znamená druh (životy modře, knihy fialově), ne dobu.
- **období** říká KDY se něco dělo → barví jen centrální čáru a minimapu.

Klíčová slova z importů zůstala jako `keywords` a nic neřídí. Kdyby někdo
příště chtěl „opravit" barvu tak, aby se zase brala z období: byla tak,
a právě proto se to předělalo.

**Velmoci a vlády jsou připnuté k hranám plochy.** Nehýbou se se svislým
posunem osy: velmoci sedí nahoře, Izrael a pod ním Juda dole. Jsou to souvislé
pásy přes celé dějiny a plovoucí by se hledaly hůř než cokoli jiného. Ostatní
pásma mezi nimi plavou a projíždějí jim pod neprůhledným podkladem.

**Vlády a velmoci leží na jedné řadě.** Navazují bez mezer (konec jedné =
začátek další), takže by je řádkování rozházelo do desítek řádků. Pásmo se
proto neřádkuje vůbec, popisek se vejde jen dovnitř pruhu a sousedé se odliší
střídavým odstínem — mezera by tam byla lež. Pruhy mají menší zaoblení než
plovoucí životy, aby četly jako díly jednoho pásu.

**Světové velmoci jsou rozsahy, ne body.** V knize jsou jako body („nástup
velmoci"), na ose ale dávají smysl jako navazující období. Řetězí se: Egypt
1600–874, Asýrie 874–625, Babylon 625–539, Médo-Persie 539–332, Řecko 332–63.
Řím zůstal 63–30 podle knihy, nedotažený k Ježíšovi.

**Setrvačnost posunu.** Po švihnutí prstem posun plynule dojede a zastaví
(exponenciální doběh s časovou konstantou 280 ms). Bez ní působil pohyb na
iPhonu a iPadu trhaně. Kreslí se v jedné trvalé rAF smyčce se značkou „je co
překreslit"; zakládat a rušit snímek při každé změně stavu bylo znát. Čas se
bere z `performance.now()` — se `event.timeStamp` doběh na iPadu nefungoval,
protože Safari u dotykových pointer událostí neručí za společnou epochu.

**Duplicity z knihy jednou.** Samuel a „SVĚTOVÁ VELMOC: Egypt" jsou v knize na
dvou osách se stejnými roky. V databázi jsou jednou, s poznámkou — aplikace nemá
deduplikační vrstvu a dva shodné pruhy pod sebou by byly chyba, ne informace.
Naproti tomu **dva Josefové zůstali oba**: Jákobův syn a Ježíšův pěstoun jsou
různí lidé, ne duplicita.

### Rodokmen je samostatná sekce, ne vrstva na ose

První návrh počítal s pohledem „Rodová linie“ — generace jako schody přímo na
časové ose. Na linii Adam → Abraham to vypadá dobře, ale zadavatel správně
namítl, že dál (Jákobových dvanáct synů, Davidovy manželky, dvě linie
k Ježíšovi) z toho bude chaos. Rozhodnutí: **do osy žádné čáry**, rodokmen je
třetí pohled s vlastním kreslením a s osou ho pojí jen proklik a sekce
„Rodina“ v detailu záznamu.

Další rozhodnutí kolem rodokmenu:

- **Osoba je samostatná věc, ne záznam osy.** Stávající záznamy se nemění,
  nová vrstva na ně jen odkazuje (`person_events`).
- **Strom kreslí program, neskládá se ručně.** Předlohou byl plakát „Slíbené
  potomstvo“ (PDF od zadavatele), ale ruční sazba by se s každou novou osobou
  rozpadla.
- **Páteř je výslovný příznak** (`persons.spine`). Teď vede Adam → David →
  Šalomoun → judští králové → Jehojakin → Šealtiel → Zerubbabel → … → Josef →
  Ježíš, tedy královskou linií podle Matouše. Lukášova linie (David → Natan →
  … → Heli → Marie) je boční větev. Je to **předpoklad k potvrzení** — stačí
  přepsat příznak u osob, kód se nemění.
- **Zdroje vazeb.** Bible a publikace z jw.org; PDF plakát zadavatel povolil
  jako zdroj nižší důvěry („ověřím si a doplním zdroje“). Většina vazeb
  (621 z 844) má jako zdroj jen plakát; tam, kde plakát sám něco značí jako
  nejisté nebo kde bylo čtení obrázku nejisté, je u vazby poznámka, co ověřit. Čísla veršů se zapisovala bez přístupu k textu nwt, proto
  je všechno `verified = false`.
- **Neověřené je vidět jen po přihlášení.** Veřejný web nemá ukazovat
  příbuzenství, které nikdo nezkontroloval.

Doplnění zbytku plakátu (496 osob, 588 vazeb) je v `data/rodokmen-doplnek.json`.
Stopa prvního naplnění je v `data/rodokmen-zaklad.json` (osoby se slugy,
vazby, propojení se záznamy). Pravdu drží databáze, soubor se neaktualizuje.
Id osob jsou odvozená: `md5('rodokmen:' || slug)::uuid`.

## Data z knihy

`scripts/prevod-wcg.mjs` převádí `data/zdroj-odvazne-chod-s-bohem.json` (přepis
knihy) na `data/odvazne-chod-s-bohem.json` (formát exportu aplikace). ID jsou
stabilní UUID odvozená ze slugu, takže opakovaný import přepíše totéž a nenadělá
kopie. Soubor jde nahrát přes **Data → Importovat**.

Konvence v datech:

- **zdroj** — jen zkratka: `wcg` (Odvážně choď s Bohem), `it "Chronologie"`,
  `nwt A6`, `ia`. Bez názvu a stran. Tři zkratky jsou zároveň **odkazem**
  zapsaným jako `[wcg](https://…)`: `wcg` míří na tu ze tří os v knize, na
  které postava nebo událost stojí (části 1–3 v `data/zdroj-odvazne-chod-s-bohem.json`,
  docid `1102025962` / `1102025964` / `1102025966`), `it „Chronologie“` na
  docid `1200000970` a `nwt „Přehled biblických knih“` na `1001061171`.
  Ostatní zkratky v témže poli zůstávají obyčejným textem.
- **poznámka** — text ze zdroje, u sloučených životů vysvětlení, u duplicit
  informace o dvojím výskytu. U knižních záznamů je to odrážkový seznam
  (`• Pisatel: …`, `• Místo psaní: …`), řádky bez tečky na konci; výjimka je
  zkratka `n. l.`, která si tečku nese sama.
- **umístění** (`placement`) — pásmo na ose. Pevný seznam v kódu:
  `velmoci`, `udalosti`, `zivoty`, `knihy`, `izrael`, `juda`.
- **štítek** (`tagId`) — druh záznamu a jeho barva. Nejvýš jeden na záznam,
  zakládá se v aplikaci.

Klíčová slova (`keywords`, dřív `events.tags`) padla — nic neřídila a plnila
formulář i vyhledávání balastem. Import je u starších souborů pořád umí přečíst
a odvodit z nich umístění.

Neznámé umístění spadne mezi rozsahy pod osou, bez štítku bude záznam šedivý.

## Co se záměrně nestaví

Relativní datování („X let po Y"), drag & drop editace na ose, veřejná
registrace, mapový pohled, převod kalendářů, **rodinné vazby kreslené přímo
v ose**.

Data pro mapu a pohledy podle postav se ale **už ukládají** (`place_name`,
`lat`, `lng`, `keywords`) a datová vrstva je oddělená od vizualizace, takže se
dají přidat bez zásahu do osy.

## Na co narazíš

- **Proměnné prostředí se zapékají do buildu.** Po jejich změně na Netlify je
  nutný nový deploy, jinak se nic nezmění.
- **Netlify skenuje deploy na hodnoty proměnných.** Veřejný anon klíč v bundlu
  je záměr; výjimka je v `netlify.toml`, bez ní build spadne.
- **Anon klíč není tajemství.** Bezpečnost stojí na RLS. Klíč `service_role`
  do aplikace nepatří.
- **Validace je na dvou místech** — v `src/lib/validation.ts` i jako CHECK
  constraints v migraci. Měň obojí.
- **Supabase na free tieru usíná.** Po sedmi dnech bez provozu se projekt uspí;
  probudit ho jde z dashboardu do 90 dnů, data se neztratí. Proto běží
  `netlify/functions/udrzet-vzhuru.mjs` jednou denně a přečte jeden řádek.
  Stojí to na tom, že web na Netlify běží — po přechodu na placený tarif se dá
  funkce smazat.
- **Řádkování je při posunu stabilní, při zoomu ne.** Pakuje se v souřadnici
  odvozené z let (`rok × pxPerYear`), která na posunu vůbec nezávisí. Dokud se
  pakovalo v pixelech plátna, měnilo se s posunem zaokrouhlení a položky se
  stejným začátkem si přehazovaly řádky. Testy to hlídají.
