/**
 * Záloha databáze do souboru: stáhne všechny tabulky aplikace přes veřejné
 * čtecí rozhraní Supabase a uloží je jako jeden JSON.
 *
 * Pouští ho jednou denně GitHub Actions (.github/workflows/zaloha.yml) a
 * výsledek zapisuje do větve `zaloha-dat`. Historie té větve je historie dat
 * den po dni — jediná jiná kopie leží v Supabase, kde bezplatný tarif zálohy
 * nedělá a hromadné úpravy nemají cestu zpět.
 *
 * Ukládají se syrové řádky tabulek, ne exportní formát aplikace: je to
 * nejvěrnější kopie a obnova z ní je prostý upsert podle `id`.
 *
 *   SUPABASE_URL=… SUPABASE_KEY=… node scripts/zaloha.mjs <cílová složka>
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Tabulky a sloupce, podle kterých se řadí — stálé pořadí dává čitelný diff. */
export const TABULKY = [
  { jmeno: 'categories', razeni: 'id' },
  { jmeno: 'tags', razeni: 'id' },
  { jmeno: 'events', razeni: 'id' },
  { jmeno: 'persons', razeni: 'id' },
  { jmeno: 'person_events', razeni: 'person_id,event_id' },
  { jmeno: 'relations', razeni: 'id' },
];

const STRANKA = 1000;

/** Stáhne celou tabulku po stránkách; Supabase vrací nejvýš 1000 řádků naráz. */
export async function stahniTabulku(url, klic, { jmeno, razeni }, fetchImpl = fetch) {
  const radky = [];
  for (let od = 0; ; od += STRANKA) {
    const adresa = `${url}/rest/v1/${jmeno}?select=*&order=${razeni}&offset=${od}&limit=${STRANKA}`;
    const odpoved = await fetchImpl(adresa, { headers: { apikey: klic, Authorization: `Bearer ${klic}` } });
    if (!odpoved.ok) throw new Error(`${jmeno}: ${odpoved.status} ${await odpoved.text()}`);
    const cast = await odpoved.json();
    radky.push(...cast);
    if (cast.length < STRANKA) return radky;
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const klic = process.env.SUPABASE_KEY;
  const slozka = process.argv[2];
  if (!url || !klic || !slozka) {
    console.error('Použití: SUPABASE_URL=… SUPABASE_KEY=… node scripts/zaloha.mjs <složka>');
    process.exit(1);
  }

  const tabulky = {};
  const pocty = {};
  for (const tabulka of TABULKY) {
    tabulky[tabulka.jmeno] = await stahniTabulku(url, klic, tabulka);
    pocty[tabulka.jmeno] = tabulky[tabulka.jmeno].length;
  }
  // Prázdná záloha je skoro jistě chyba (uspaný projekt, špatný klíč), ne
  // skutečný stav. Nesmí přepsat poslední dobrou kopii.
  if (pocty.events === 0) throw new Error('Tabulka events je prázdná – záloha se neukládá.');

  mkdirSync(slozka, { recursive: true });
  // data.json se mění jen se změnou dat, stav.json každý den: podle něj je
  // vidět, že záloha běží, i když se v datech nic nehnulo.
  writeFileSync(join(slozka, 'data.json'), JSON.stringify({ tabulky }, null, 1) + '\n');
  writeFileSync(join(slozka, 'stav.json'), JSON.stringify({ posledniBeh: new Date().toISOString(), pocty }, null, 1) + '\n');
  console.log('Zálohováno:', pocty);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
