-- Klíčová slova, pásmo „Ostatní" a úklid textů.
--
-- Klíčová slova (`events.keywords`, dřív `events.tags`) nic neřídila — zbyla
-- po době, kdy se z nich odvozovalo pásmo. Od zavedení `placement` a `tag_id`
-- je to jen popisný balast, který se plete do vyhledávání i do formuláře.
--
-- Pásmo „Ostatní" bylo záchytné na neznámé hodnoty. Padly do něj jen záznamy
-- se štítkem `období` — a ty patří mezi rozsahy pod osou. Bez záchytného
-- pásma se musí neznámá hodnota chytit v kódu (DEFAULT_PLACEMENT = 'zivoty').

-- --- klíčová slova pryč ------------------------------------------------------

alter table events drop column if exists keywords;

-- --- „Ostatní" pryč, obsah mezi rozsahy pod osou -----------------------------

update events set placement = 'zivoty' where placement = 'ostatni';

alter table events alter column placement set default 'zivoty';

alter table events drop constraint if exists events_placement_known;
alter table events add constraint events_placement_known check (
  placement in ('velmoci', 'udalosti', 'zivoty', 'knihy', 'izrael', 'juda')
);

-- --- štítek se jmenuje podle toho, co znamená -------------------------------

update tags set name = 'kniha dokončeno' where name = 'kniha dopsáno';

-- --- české uvozovky ve zdrojích a poznámkách ---------------------------------
-- Zdroje z hesla it „Chronologie“ přišly z importu s anglickými uvozovkami.

update events set source = regexp_replace(source, '"([^"]*)"', '„\1“', 'g')
  where source like '%"%';
update events set note = regexp_replace(note, '"([^"]*)"', '„\1“', 'g')
  where note like '%"%';

comment on column events.placement is 'kam na osu záznam patří; hodnoty zná rozvržení v layout.ts';
