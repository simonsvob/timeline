# Kontext projektu — pro navazující chaty

Shrnutí pro konverzaci, která na projektu pokračuje bez historie. Popisuje, co
aplikace je, jak je zapojená, co už se rozhodlo a proč, a co zbývá.

Poslední aktualizace: 9. srpna 2026.

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

## Stav

Aplikace je hotová a nasazená. Funguje osa s plynulým zoomem, formulářová
editace, správa štítků i období, tabulkový přehled, export/import a přihlášení.
V databázi je **552 záznamů**: tři časové osy z knihy *Odvážně choď s Bohem*
(str. 14–15, 104–105, 186–187), chronologie králů, knih a událostí z hesla
„Chronologie" a z dodatku nwt A6, přehled biblických knih a dávka událostí
z tabulky zadavatele. Testů 164, všechny procházejí.

Ověřeno měřením, ne odhadem: 60 fps (medián 16,6 ms na snímek) při zoomu
a posunu s 3000 záznamy; RLS testována chováním pod rolemi `anon`
i `authenticated`, ne jen existencí politik.

### Co je rozdělané

- **Období jsou předběžná.** Šest kategorií (do potopy, patriarchové, soudci,
  králové, od návratu z Babylonu, od Ježíše dál) je zatím na zkoušku. Hranice
  jsou odvozené z událostí v datech a dají se změnit ve správě období.
  Barví jen osu a minimapu, na záznamy nesahají. Zadavatel si se systémem
  období chce do budoucna ještě pohrát.
- **Sada štítků.** Osm štítků: `život`, `událost`, `kniha dopsáno`,
  `kniha zahrnuto`, `velmoc`, `vláda Judsko`, `vláda Izrael`, `období`.
  Prvních sedm zadal zadavatel, `období` vzniklo při importu pro záznamy,
  které nejsou ani událost, ani život — dá se sloučit do `událost`.
- **Filtrování.** Čipy pásem jsou zatím schované pod tlačítkem „Zobrazit
  pásma". Zadavatel chce filtry ladit později; teď nejsou priorita.
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

**Osa nemá nástrojovou lištu.** Skok na rok, tlačítka zoomu ani „celý rozsah"
tam nejsou — pinch a tažení to zvládnou rychleji a lišta jen ubírala místo.
Hledání se přesunulo do hlavičky, přihlášení je jen ikona zámku.

**Události nahoře, životy dole.** Bodové události mají vlastní pásmo nahoře
a kreslí se jako svislé značky. Rozházené mezi pruhy se ztrácely a kolečka se
s pruhy pletla.

**Pásma podle umístění, ne dvě pevná pásma.** Osa je rozdělená na pásma
(`BANDS` v `layout.ts`), shora dolů: světové velmoci,
události, čára, životy, zahrnutá období knih, ostatní, severní izraelské
království, jižní judské království. Judské
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

## Data z knihy

`scripts/prevod-wcg.mjs` převádí `data/zdroj-odvazne-chod-s-bohem.json` (přepis
knihy) na `data/odvazne-chod-s-bohem.json` (formát exportu aplikace). ID jsou
stabilní UUID odvozená ze slugu, takže opakovaný import přepíše totéž a nenadělá
kopie. Soubor jde nahrát přes **Data → Importovat**.

Konvence v datech:

- **zdroj** — jen zkratka: `wcg` (Odvážně choď s Bohem), `it "Chronologie"`,
  `nwt A6`, `ia`. Bez názvu a stran.
- **poznámka** — text ze zdroje, u sloučených životů vysvětlení, u duplicit
  informace o dvojím výskytu.
- **umístění** (`placement`) — pásmo na ose. Pevný seznam v kódu:
  `velmoci`, `udalosti`, `zivoty`, `knihy`, `izrael`, `juda`, `ostatni`.
- **štítek** (`tagId`) — druh záznamu a jeho barva. Nejvýš jeden na záznam,
  zakládá se v aplikaci.
- **klíčová slova** (`keywords`, dřív se jmenovala `tags`) — `kral`,
  `narozeni`, `predpotopni`, `popotopni`, `kr` … Čistě popisné, hledá se v nich
  v tabulce, na vykreslení nemají vliv.

Nový záznam potřebuje obojí: bez umístění spadne do pásma „Ostatní", bez štítku
bude šedivý.

## Co se záměrně nestaví

Relativní datování („X let po Y"), drag & drop editace na ose, veřejná
registrace, mapový pohled, pohledy podle období a postav, převod kalendářů.

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
