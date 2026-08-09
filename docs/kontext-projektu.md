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
editace, správa kategorií, tabulkový přehled, export/import a přihlášení.
V databázi je **188 záznamů**: tři časové osy z knihy *Odvážně choď s Bohem*
(str. 14–15, 104–105, 186–187) a chronologie králů, knih a událostí z hesla
„Chronologie" a z dodatku nwt A6. Testů 152, všechny procházejí.

Ověřeno měřením, ne odhadem: 60 fps (medián 16,6 ms na snímek) při zoomu
a posunu s 3000 záznamy; RLS testována chováním pod rolemi `anon`
i `authenticated`, ne jen existencí politik.

### Co je rozdělané

- **Období jsou předběžná.** Šest kategorií (do potopy, patriarchové, soudci,
  králové, od návratu z Babylonu, od Ježíše dál) je zatím na zkoušku. Hranice
  jsou odvozené z událostí v datech a dají se změnit ve správě kategorií.
  Zadavatel ještě zvažuje, jestli mají všechny postavy nosit barvu období;
  zatím ji nosí všechny — každý záznam má kategorii podle roku začátku.
- **Priorita postav.** Do budoucna má jít postavy seřadit podle důležitosti,
  aby výš byly výraznější. Zatím řádkuje jen greedy packing podle místa.

## Rozhodnutí a proč

Tahle část je důležitější než seznam funkcí — bez ní se dřív nebo později
někdo pokusí „opravit" něco, co je záměr.

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

**Pásma podle štítků, ne dvě pevná pásma.** Osa je rozdělená na pásma
definovaná štítky (`BANDS` v `layout.ts`), shora dolů: světové velmoci,
události, čára, životy, vláda nad Judou, vláda nad Izraelem, ostatní. Judské
a izraelské království vládly současně — v jednom pásmu by je řádkování
promíchalo a nešlo by odečíst, kdo vládl souběžně s kým. Pásmo bez záznamů
nebo skryté nezabírá žádné svislé místo.

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
překreslit"; zakládat a rušit snímek při každé změně stavu bylo znát.

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
- **štítky** — určují pásmo na ose, nic jiného. Rozvržení je zná:
  `velmoc`, `udalost`, `kniha`, `zivot`, `vlada-juda`, `vlada-izrael`,
  `vlada-12kmenu`. Ostatní (`kral`, `narozeni`, `predpotopni`, `popotopni`)
  jsou zatím jen popisné.

Každý záznam musí mít aspoň jeden štítek — bez něj spadne do pásma „Ostatní".

## Co se záměrně nestaví

Relativní datování („X let po Y"), drag & drop editace na ose, veřejná
registrace, mapový pohled, pohledy podle období a postav, převod kalendářů.

Data pro mapu a pohledy podle postav se ale **už ukládají** (`place_name`,
`lat`, `lng`, `tags`) a datová vrstva je oddělená od vizualizace, takže se dají
přidat bez zásahu do osy.

## Na co narazíš

- **Proměnné prostředí se zapékají do buildu.** Po jejich změně na Netlify je
  nutný nový deploy, jinak se nic nezmění.
- **Netlify skenuje deploy na hodnoty proměnných.** Veřejný anon klíč v bundlu
  je záměr; výjimka je v `netlify.toml`, bez ní build spadne.
- **Anon klíč není tajemství.** Bezpečnost stojí na RLS. Klíč `service_role`
  do aplikace nepatří.
- **Validace je na dvou místech** — v `src/lib/validation.ts` i jako CHECK
  constraints v migraci. Měň obojí.
