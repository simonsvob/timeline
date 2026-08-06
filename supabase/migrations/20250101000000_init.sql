-- Biblická časová osa – počáteční schéma
-- Spusť přes Supabase SQL Editor nebo `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabulky
-- ---------------------------------------------------------------------------

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,          -- hex, např. #a2563c
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('point','range')),
  category_id uuid references categories(id) on delete set null,

  start_year int not null,      -- astronomický rok: 1 př. n. l. = 0, 2 př. n. l. = -1
  start_month int check (start_month between 1 and 12),
  start_day int check (start_day between 1 and 31),
  start_approx boolean not null default false,

  end_year int,                 -- jen pro type='range'
  end_month int check (end_month between 1 and 12),
  end_day int check (end_day between 1 and 31),
  end_approx boolean not null default false,

  source text,                  -- odkud údaj pochází (verš, publikace)
  note text,                    -- delší poznámka
  place_name text,              -- příprava na budoucí mapový pohled
  lat double precision,
  lng double precision,
  tags text[] not null default '{}',  -- příprava na pohledy podle období/postav

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- den vyžaduje měsíc (rok je not null, takže měsíc rok vždy má)
  constraint events_start_day_needs_month check (start_day is null or start_month is not null),
  constraint events_end_day_needs_month check (end_day is null or end_month is not null),
  -- měsíc/den konce vyžadují rok konce
  constraint events_end_month_needs_year check (end_month is null or end_year is not null),

  -- bod nemá žádná koncová pole; rozsah musí mít alespoň rok konce
  constraint events_point_has_no_end check (
    type <> 'point'
    or (end_year is null and end_month is null and end_day is null and end_approx = false)
  ),
  constraint events_range_has_end check (type <> 'range' or end_year is not null),

  -- konec nesmí být dříve než začátek (porovnání po složkách, chybějící = začátek jednotky)
  constraint events_end_after_start check (
    end_year is null
    or (end_year, coalesce(end_month, 1), coalesce(end_day, 1))
       >= (start_year, coalesce(start_month, 1), coalesce(start_day, 1))
  ),

  -- souřadnice buď obě, nebo žádná
  constraint events_latlng_pair check ((lat is null) = (lng is null)),
  constraint events_lat_range check (lat is null or (lat between -90 and 90)),
  constraint events_lng_range check (lng is null or (lng between -180 and 180))
);

create index if not exists events_start_year_idx on events (start_year);
create index if not exists events_category_idx on events (category_id);
create index if not exists events_tags_idx on events using gin (tags);
create index if not exists categories_sort_idx on categories (sort_order);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on categories;
create trigger categories_set_updated_at
  before update on categories
  for each row execute function set_updated_at();

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: čtení veřejné, zápis jen pro přihlášené
-- ---------------------------------------------------------------------------

alter table categories enable row level security;
alter table events enable row level security;

drop policy if exists categories_select_public on categories;
create policy categories_select_public on categories
  for select to anon, authenticated using (true);

drop policy if exists categories_insert_auth on categories;
create policy categories_insert_auth on categories
  for insert to authenticated with check (true);

drop policy if exists categories_update_auth on categories;
create policy categories_update_auth on categories
  for update to authenticated using (true) with check (true);

drop policy if exists categories_delete_auth on categories;
create policy categories_delete_auth on categories
  for delete to authenticated using (true);

drop policy if exists events_select_public on events;
create policy events_select_public on events
  for select to anon, authenticated using (true);

drop policy if exists events_insert_auth on events;
create policy events_insert_auth on events
  for insert to authenticated with check (true);

drop policy if exists events_update_auth on events;
create policy events_update_auth on events
  for update to authenticated using (true) with check (true);

drop policy if exists events_delete_auth on events;
create policy events_delete_auth on events
  for delete to authenticated using (true);
