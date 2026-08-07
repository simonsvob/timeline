# Kontext projektu — pro navazující chaty

Shrnutí pro konverzaci, která na projektu pokračuje bez historie. Popisuje, co
aplikace je, jak je zapojená, co už se rozhodlo a proč, a co zbývá.

Poslední aktualizace: 7. srpna 2026.

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
V databázi je **68 záznamů** — tři časové osy z knihy *Odvážně choď s Bohem*
(str. 14–15, 104–105, 186–187). Testů 133, všechny procházejí.

Ověřeno měřením, ne odhadem: 60 fps (medián 16,6 ms na snímek) při zoomu
a posunu s 3000 záznamy; RLS testována chováním pod rolemi `anon`
i `authenticated`, ne jen existencí politik.

### Co je rozdělané

- **Tři testovací záznamy v databázi** — Adam, Enoch, Noe bez zdroje a štítků,
  vytvořené při zkoušení přihlášení. Mají stejné roky jako naimportované, takže
  se na ose kreslí dvakrát. Čeká se na rozhodnutí, jestli je smazat.
- **Žádné kategorie.** Všech 68 záznamů má `category_id` null, na ose jsou tedy
  šedé. Struktura knihy je zachovaná ve štítcích, takže z nich jdou kategorie
  kdykoli vyrobit.

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

- **zdroj** — `Odvážně choď s Bohem, 2. část (str. 104–105)`
- **štítky** — jména jednotlivých osob (u sloučených čar všechna), oddíl v knize
  („Období soudců"), část („1. část") a příznaky („světová velmoc",
  „sloučené životy"). Celkem 73 unikátních štítků.
- **poznámka** — text z knihy, u sloučených životů vysvětlení, u duplicit
  informace o dvojím výskytu.

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
