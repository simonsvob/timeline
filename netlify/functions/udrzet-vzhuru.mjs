/**
 * Naplánovaná funkce, která jednou denně sáhne do databáze.
 *
 * Supabase na free tieru uspí projekt po sedmi dnech bez provozu. Aplikace se
 * databáze ptá jen když ji někdo otevře, takže stačí týden bez návštěvy a web
 * zůstane prázdný, dokud projekt někdo ručně neprobudí. Tenhle dotaz je to
 * nejlevnější, co projekt udrží vzhůru: jedno `id` z tabulky událostí.
 *
 * Čte stejné proměnné jako aplikace. Anon klíč je veřejný — čtení povoluje RLS
 * roli `anon`, zápis ne — takže tady žádné tajemství nepřibývá.
 */

export default async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY.');
    return new Response('chybí nastavení', { status: 500 });
  }

  const odpoved = await fetch(`${url}/rest/v1/events?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!odpoved.ok) {
    console.error(`Dotaz selhal: ${odpoved.status} ${await odpoved.text()}`);
    return new Response('dotaz selhal', { status: 502 });
  }

  console.log('Databáze odpověděla, projekt zůstává vzhůru.');
  return new Response('ok');
};

/** Jednou denně o půlnoci UTC. */
export const config = { schedule: '@daily' };
