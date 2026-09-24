-- Výslovná práva pro Data API (supabase-js, PostgREST).
--
-- Od 30. října 2026 Supabase nově vzniklým tabulkám ve schématu `public`
-- nepřiděluje práva pro `anon`, `authenticated` a `service_role` sám.
-- Existující tabulky si je nechávají, takže na ostré databázi je tahle
-- migrace bez účinku. Jde o zakládání od nuly — nový projekt, preview větev,
-- `supabase db reset`: tam by předchozí migrace vytvořily tabulky, na které
-- aplikace nedosáhne, a osa by nenačetla nic.
--
-- Práva jen otevírají dveře. Kdo smí co, dál rozhoduje RLS: `anon` dostává
-- jen čtení a zápis hlídají politiky pro `authenticated`.
--
-- Nová tabulka = GRANT ve stejné migraci, která ji zakládá.

grant select
  on public.categories, public.events, public.tags
  to anon;

grant select, insert, update, delete
  on public.categories, public.events, public.tags
  to authenticated;

grant select, insert, update, delete
  on public.categories, public.events, public.tags
  to service_role;
