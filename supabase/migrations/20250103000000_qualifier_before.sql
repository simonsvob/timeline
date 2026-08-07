-- Otevřená hranice doleva: „před rokem X".
--
-- Doplňuje 'min' a 'after' (obojí otevírá doprava) o případ, kdy se ví jen,
-- že údaj leží PŘED zadaným rokem — např. „Smrt Abela: před rokem 3896 př. n. l.".

alter table events drop constraint if exists events_start_qualifier_values;
alter table events
  add constraint events_start_qualifier_values
  check (start_qualifier is null or start_qualifier in ('min', 'after', 'before'));

alter table events drop constraint if exists events_end_qualifier_values;
alter table events
  add constraint events_end_qualifier_values
  check (end_qualifier is null or end_qualifier in ('min', 'after', 'before'));
