-- Kategorie jako časová období.
--
-- Osa i minimapa se barví podle období, ne podle jednotlivých záznamů, takže
-- kategorie potřebuje vlastní rozsah let. Sloupce jsou nepovinné — kategorie
-- bez rozsahu se chová jako dřív (jen barva a filtr) a do barvení osy nevstupuje.

alter table categories
  add column if not exists from_year int,
  add column if not exists to_year int;

alter table categories drop constraint if exists categories_period_order;
alter table categories
  add constraint categories_period_order
  check (from_year is null or to_year is null or to_year >= from_year);

comment on column categories.from_year is 'astronomický rok začátku období (včetně)';
comment on column categories.to_year is 'astronomický rok konce období (vyjma)';
