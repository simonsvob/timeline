-- Pořadí dítěte mezi sourozenci. Roky narození má jen zlomek osob, abeceda by
-- Jákobovy syny přeházela; pořadí se proto ukládá výslovně u vazby na rodiče.
-- Hodnoty pro první dávku osob se nastavily při nasazení migrace (viz
-- data/rodokmen-zaklad.json); nové vazby je dostanou z aplikace.
alter table relations add column if not exists sort_order integer not null default 0;
