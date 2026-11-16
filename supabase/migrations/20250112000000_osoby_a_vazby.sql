-- Osoby a rodinné vazby: datová vrstva pro sekci Rodokmen.
--
-- Osa znala jen záznamy. David v ní byl dvakrát (život a vláda), jeden pruh
-- nesl devět jmen a příbuzenství neexistovalo vůbec. Osoba je proto vlastní
-- věc, na kterou se záznamy osy jen odkazují:
--
--   persons        KDO — jméno, rozlišovač stejnojmenných, role, hlavní linie
--   person_events  který záznam osy k osobě patří a v jaké roli
--   relations      vazba mezi dvěma osobami, její jistota a zdroj
--
-- Sourozenci, prarodiče a vnuci se neukládají, počítají se z rodičů.
-- Stávající tabulky se nemění.

-- --- osoby -----------------------------------------------------------------

create table if not exists persons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Rozlišovač stejnojmenných: „syn Teracha“. Zobrazuje se jen tam, kde by
  -- se jména pletla (Nachor děd × Nachor bratr Abrahama).
  qualifier text,
  -- Jiné podoby jména ve zdrojích: Kenan / Kainan, Uzzijáš / Azarjáš.
  alt_names text[] not null default '{}',
  gender text check (gender in ('m', 'f')),
  -- Role pro obarvení v rodokmenu. Seznam hlídá aplikace (PERSON_ROLES),
  -- stejně jako u štítků; král se navíc pozná z přiřazené vlády.
  roles text[] not null default '{}',
  -- Hlavní linie rodokmenu („páteř“). Výslovný příznak, ne výpočet: od Davida
  -- vedou k Ježíšovi dvě linie a o tom, která je páteř, rozhoduje člověk.
  spine boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint persons_name_not_blank check (length(btrim(name)) > 0)
);

-- --- osoba ↔ záznam osy ----------------------------------------------------

create table if not exists person_events (
  person_id uuid not null references persons (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  -- zivot = pruh života, vlada = pruh vlády, zminka = osoba je jen jednou
  -- z víc lidí ve skupinovém pruhu nebo se jí záznam týká
  role text not null check (role in ('zivot', 'vlada', 'zminka')),
  primary key (person_id, event_id)
);

create index if not exists person_events_event_idx on person_events (event_id);

-- --- vazby -----------------------------------------------------------------

create table if not exists relations (
  id uuid primary key default gen_random_uuid(),
  -- rodic:      from je rodič, to je dítě
  -- pestoun:    from je adoptivní rodič, to je dítě
  -- predek:     from je předek, to potomek; zdroj generace mezi nimi vynechává
  -- manzelstvi: from a to jsou manželé (na pořadí nezáleží)
  kind text not null check (kind in ('rodic', 'pestoun', 'predek', 'manzelstvi')),
  from_person uuid not null references persons (id) on delete cascade,
  to_person uuid not null references persons (id) on delete cascade,
  -- Jistota TVRZENÍ: výslovně ve zdroji / odvozeno z víc míst nebo z výkladu /
  -- sporné, zdroje se liší. Nezávislé na `verified`.
  certainty text not null default 'vyslovne'
    check (certainty in ('vyslovne', 'odvozeno', 'sporne')),
  -- Stejný zápis jako u záznamů osy, včetně odkazů [text](https://…).
  source text,
  note text,
  -- Ověřil to člověk proti Bibli nebo publikaci? Neověřené vazby vidí jen
  -- přihlášený; vznikají při hromadném zadání z méně spolehlivých podkladů.
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relations_not_self check (from_person <> to_person),
  constraint relations_unique unique (kind, from_person, to_person)
);

create index if not exists relations_from_idx on relations (from_person);
create index if not exists relations_to_idx on relations (to_person);

-- --- updated_at ------------------------------------------------------------

drop trigger if exists persons_set_updated_at on persons;
create trigger persons_set_updated_at
  before update on persons
  for each row execute function set_updated_at();

drop trigger if exists relations_set_updated_at on relations;
create trigger relations_set_updated_at
  before update on relations
  for each row execute function set_updated_at();

-- --- RLS: čtení veřejné, zápis jen pro přihlášené ---------------------------

alter table persons enable row level security;
alter table person_events enable row level security;
alter table relations enable row level security;

drop policy if exists persons_select_public on persons;
create policy persons_select_public on persons for select to anon, authenticated using (true);
drop policy if exists persons_insert_auth on persons;
create policy persons_insert_auth on persons for insert to authenticated with check (true);
drop policy if exists persons_update_auth on persons;
create policy persons_update_auth on persons for update to authenticated using (true) with check (true);
drop policy if exists persons_delete_auth on persons;
create policy persons_delete_auth on persons for delete to authenticated using (true);

drop policy if exists person_events_select_public on person_events;
create policy person_events_select_public on person_events for select to anon, authenticated using (true);
drop policy if exists person_events_insert_auth on person_events;
create policy person_events_insert_auth on person_events for insert to authenticated with check (true);
drop policy if exists person_events_update_auth on person_events;
create policy person_events_update_auth on person_events for update to authenticated using (true) with check (true);
drop policy if exists person_events_delete_auth on person_events;
create policy person_events_delete_auth on person_events for delete to authenticated using (true);

drop policy if exists relations_select_public on relations;
create policy relations_select_public on relations for select to anon, authenticated using (true);
drop policy if exists relations_insert_auth on relations;
create policy relations_insert_auth on relations for insert to authenticated with check (true);
drop policy if exists relations_update_auth on relations;
create policy relations_update_auth on relations for update to authenticated using (true) with check (true);
drop policy if exists relations_delete_auth on relations;
create policy relations_delete_auth on relations for delete to authenticated using (true);

-- --- práva pro Data API (viz 20250111000000_granty_data_api.sql) ------------

grant select on public.persons, public.person_events, public.relations to anon;
grant select, insert, update, delete
  on public.persons, public.person_events, public.relations to authenticated;
grant select, insert, update, delete
  on public.persons, public.person_events, public.relations to service_role;
