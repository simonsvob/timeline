-- Štítky s barvou a umístění záznamu na ose.
--
-- Dosud rozhodovaly o obojím `events.tags` (textové pole) a barvu bral záznam
-- z kategorie. Bylo to naruby: kategorie znamenala období, tedy barvu podle
-- toho KDY se něco stalo, a štítky se musely trefit do jmen, která znal jen
-- kód. Nově jsou to dvě jasně oddělené věci:
--
--   umístění (`events.placement`) — kam na osu záznam patří. Pevný seznam,
--     protože ke každé hodnotě patří i kus vykreslení (připnutý pás, jedna
--     řada, tvar). Ve formuláři se vybírá z rozbalovátka.
--   štítek (`events.tag_id`) — co to je za druh záznamu. Nese barvu, dá se
--     zakládat v aplikaci a záznam má nejvýš jeden.
--
-- Kategorie zůstávají, ale už jen jako období barvící osu a minimapu; vazba
-- na záznamy padá. Původní `events.tags` se přejmenovává na `keywords`, aby
-- se dvě různé věci nejmenovaly stejně — zůstávají jako popisná klíčová slova
-- z importů (`kr`, `kral`, `narozeni`, …).

-- --- štítky ----------------------------------------------------------------

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_not_blank check (length(btrim(name)) > 0),
  constraint tags_color_hex check (color ~ '^#[0-9a-fA-F]{6}$')
);

create unique index if not exists tags_name_unique on tags (lower(btrim(name)));

alter table tags enable row level security;

drop policy if exists "tags jsou veřejné ke čtení" on tags;
create policy "tags jsou veřejné ke čtení" on tags for select using (true);

drop policy if exists "tags mění jen přihlášení" on tags;
create policy "tags mění jen přihlášení" on tags for all
  to authenticated using (true) with check (true);

-- --- záznamy ---------------------------------------------------------------

alter table events add column if not exists tag_id uuid references tags (id) on delete set null;
alter table events add column if not exists placement text;

-- Klíčová slova: přejmenování, ne nový sloupec — data zůstávají.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'events' and column_name = 'tags')
     and not exists (select 1 from information_schema.columns
                     where table_name = 'events' and column_name = 'keywords')
  then
    alter table events rename column tags to keywords;
  end if;
end $$;

-- --- naplnění umístění podle dosavadních klíčových slov ---------------------
-- Pořadí odpovídá tomu, jak pásma vyhodnocovalo rozvržení: první shoda vyhrává.

update events set placement = case
  when 'velmoc'        = any(keywords) then 'velmoci'
  when 'vlada-izrael'  = any(keywords) then 'izrael'
  when 'vlada-juda'    = any(keywords) then 'juda'
  when 'vlada-12kmenu' = any(keywords) then 'juda'
  when 'kniha-zahrnuto' = any(keywords) then 'knihy'
  when 'udalost'       = any(keywords) then 'udalosti'
  when 'kniha'         = any(keywords) then 'udalosti'
  when 'kniha-dokonceno' = any(keywords) then 'udalosti'
  when 'zivot'         = any(keywords) then 'zivoty'
  else 'ostatni'
end
where placement is null;

alter table events alter column placement set default 'ostatni';
alter table events alter column placement set not null;

alter table events drop constraint if exists events_placement_known;
alter table events add constraint events_placement_known check (
  placement in ('velmoci', 'udalosti', 'zivoty', 'knihy', 'izrael', 'juda', 'ostatni')
);

-- --- výchozí štítky a jejich přiřazení --------------------------------------
-- Barva teď znamená DRUH záznamu, ne období. Ids jsou pevná, aby šla migrace
-- pustit znovu bez duplikátů. Narození patří k životům, ne k událostem —
-- štítek je o tom, čeho se záznam týká, umístění o tom, kam na osu padne.

insert into tags (id, name, color, sort_order) values
  ('22222222-0000-4000-8000-000000000001', 'život',          '#3a7ca8', 0),
  ('22222222-0000-4000-8000-000000000002', 'událost',        '#b1734c', 1),
  ('22222222-0000-4000-8000-000000000003', 'kniha dopsáno',  '#7a77ba', 2),
  ('22222222-0000-4000-8000-000000000004', 'kniha zahrnuto', '#9a86c9', 3),
  ('22222222-0000-4000-8000-000000000005', 'velmoc',         '#6f7f3f', 4),
  ('22222222-0000-4000-8000-000000000006', 'vláda Judsko',   '#a8813a', 5),
  ('22222222-0000-4000-8000-000000000007', 'vláda Izrael',   '#8f5c8a', 6),
  ('22222222-0000-4000-8000-000000000008', 'období',         '#3a9371', 7)
on conflict (id) do update set
  name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;

update events set tag_id = case
  when 'velmoc'         = any(keywords) then '22222222-0000-4000-8000-000000000005'::uuid
  when 'vlada-izrael'   = any(keywords) then '22222222-0000-4000-8000-000000000007'::uuid
  when keywords && array['vlada-juda', 'vlada-12kmenu'] then '22222222-0000-4000-8000-000000000006'::uuid
  when 'kniha-zahrnuto' = any(keywords) then '22222222-0000-4000-8000-000000000004'::uuid
  when keywords && array['kniha', 'kniha-dokonceno'] then '22222222-0000-4000-8000-000000000003'::uuid
  when keywords && array['zivot', 'narozeni'] then '22222222-0000-4000-8000-000000000001'::uuid
  when 'obdobi'         = any(keywords) then '22222222-0000-4000-8000-000000000008'::uuid
  else '22222222-0000-4000-8000-000000000002'::uuid
end;

-- --- kategorie už neurčují barvu záznamu ------------------------------------
-- Zůstávají jako období, která barví osu a minimapu; vazba na záznamy padá.

alter table events drop column if exists category_id;

comment on column events.placement is 'kam na osu záznam patří; hodnoty zná rozvržení v layout.ts';
comment on column events.tag_id is 'druh záznamu — nese barvu; nejvýš jeden na záznam';
comment on column events.keywords is 'popisná klíčová slova z importů, na vykreslení nemají vliv';
