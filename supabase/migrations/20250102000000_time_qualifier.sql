-- Otevřená hranice časového údaje.
--
-- Třetí nezávislá vlastnost vedle přesnosti (co je vyplněno) a jistoty
-- (`approx`): rok není znám, ví se jen, že leží za zadanou hodnotou.
--   'min'   … „žil nejméně do" – rok úmrtí není znám
--   'after' … „po roce" – událost nastala někdy potom
--
-- Nesmí se slévat s `approx`: „min. 64 n. l." říká, že rok neznáme a je aspoň
-- 64; „~64 n. l." říká, že rok odhadujeme na 64. Jsou to různá tvrzení a údaj
-- může nést obojí zároveň („min. ~65 n. l.").

alter table events
  add column if not exists start_qualifier text,
  add column if not exists end_qualifier text;

alter table events drop constraint if exists events_start_qualifier_values;
alter table events
  add constraint events_start_qualifier_values
  check (start_qualifier is null or start_qualifier in ('min', 'after'));

alter table events drop constraint if exists events_end_qualifier_values;
alter table events
  add constraint events_end_qualifier_values
  check (end_qualifier is null or end_qualifier in ('min', 'after'));

-- bod nemá žádná koncová pole, kvalifikátor konce nevyjímaje
alter table events drop constraint if exists events_point_has_no_end;
alter table events
  add constraint events_point_has_no_end
  check (
    type <> 'point'
    or (
      end_year is null and end_month is null and end_day is null
      and end_approx = false and end_qualifier is null
    )
  );
