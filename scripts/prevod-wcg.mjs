/**
 * Převod dat z knihy Odvážně choď s Bohem do formátu aplikace.
 *
 * Vstup:  data/zdroj-odvazne-chod-s-bohem.json (přepis tří časových os z knihy)
 * Výstup: data/odvazne-chod-s-bohem.json       (formát exportu aplikace)
 *         + volitelně SQL na stdout (--sql)
 *
 * Rozhodnutí zadavatele promítnutá do převodu:
 *   - žádné kategorie (záznamy se importují bez kategorie),
 *   - duplicity (Samuel, SVĚTOVÁ VELMOC: Egypt) jen jednou, s poznámkou,
 *   - Štěpán: konec 33 n. l., varianta 34 zůstává v poznámce,
 *   - zdroj je jen zkratka knihy „wcg", štítky se negenerují.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

/** Do zdroje jde jen zkratka knihy, nic dalšího. */
const ZKRATKA_KNIHY = 'wcg';

/** Slugy, které se v knize opakují a naimportují se jen jednou. */
const VYNECHAT = new Set(['p2-samuel', 'p2-ev-velmoc-egypt']);

const POZNAMKA_DUPLICITY =
  'V knize je uvedeno na obou časových osách (1. i 2. část) se stejnými roky.';

/** Stabilní UUID ze slugu (UUID v5), aby byl opakovaný import idempotentní. */
const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function uuidZeSlugu(slug) {
  const hash = createHash('sha1');
  hash.update(Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex'));
  hash.update(Buffer.from(slug, 'utf8'));
  const b = hash.digest();
  b[6] = (b[6] & 0x0f) | 0x50; // verze 5
  b[8] = (b[8] & 0x3f) | 0x80; // varianta
  const h = b.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Rok letopočtu + éra -> astronomický rok (1 př. n. l. = 0). */
function astronomickyRok({ year, era }) {
  return era === 'CE' ? year : 1 - year;
}

function prevedCas(uzel) {
  if (!uzel) return null;
  return {
    year: astronomickyRok(uzel),
    month: null,
    day: null,
    approx: uzel.approx === true,
    qualifier: uzel.qualifier ?? null,
  };
}

function prevedZaznam(z) {
  const poznamky = [];
  if (z.note) poznamky.push(z.note);
  if (z.flags.includes('duplicate')) poznamky.push(POZNAMKA_DUPLICITY);

  const konec = prevedCas(z.end);
  if (z.end?.alt_year) {
    // zkratka éry už tečkou končí, další by byla navíc
    poznamky.push(`Kniha uvádí ${z.end.year}/${z.end.alt_year} ${z.end.era === 'CE' ? 'n. l.' : 'př. n. l.'}`);
  }

  return {
    id: uuidZeSlugu(z.id),
    name: z.title,
    type: z.kind,
    categoryId: null,
    start: prevedCas(z.start),
    end: z.kind === 'range' ? konec : null,
    source: ZKRATKA_KNIHY,
    note: poznamky.length > 0 ? poznamky.join(' ') : null,
    placeName: null,
    lat: null,
    lng: null,
    // Štítky se zatím nepoužívají – zadavatel se teprve rozhodne, jak s nimi naloží.
    tags: [],
    createdAt: '',
    updatedAt: '',
  };
}

const zdroj = JSON.parse(readFileSync(new URL('../data/zdroj-odvazne-chod-s-bohem.json', import.meta.url)));
const zaznamy = zdroj.filter((z) => !VYNECHAT.has(z.id)).map(prevedZaznam);

const soubor = {
  schemaVersion: 2,
  exportedAt: new Date().toISOString(),
  categories: [],
  events: zaznamy,
};

writeFileSync(
  new URL('../data/odvazne-chod-s-bohem.json', import.meta.url),
  `${JSON.stringify(soubor, null, 2)}\n`,
);

// --- SQL ---------------------------------------------------------------
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const qArr = (a) => (a.length === 0 ? `'{}'` : `array[${a.map(q).join(',')}]`);
const qNum = (v) => (v === null || v === undefined ? 'null' : String(v));
const qBool = (v) => (v ? 'true' : 'false');

if (process.argv.includes('--sql')) {
  const radky = zaznamy.map((e) => {
    const s = e.start;
    const k = e.end;
    return `(${[
      q(e.id), q(e.name), q(e.type), 'null',
      qNum(s.year), qNum(s.month), qNum(s.day), qBool(s.approx), q(s.qualifier),
      qNum(k?.year ?? null), qNum(k?.month ?? null), qNum(k?.day ?? null),
      qBool(k?.approx ?? false), q(k?.qualifier ?? null),
      q(e.source), q(e.note), qArr(e.tags),
    ].join(', ')})`;
  });
  console.log(`insert into events (
  id, name, type, category_id,
  start_year, start_month, start_day, start_approx, start_qualifier,
  end_year, end_month, end_day, end_approx, end_qualifier,
  source, note, tags
) values
${radky.join(',\n')}
on conflict (id) do update set
  name = excluded.name, type = excluded.type,
  start_year = excluded.start_year, start_month = excluded.start_month,
  start_day = excluded.start_day, start_approx = excluded.start_approx,
  start_qualifier = excluded.start_qualifier,
  end_year = excluded.end_year, end_month = excluded.end_month,
  end_day = excluded.end_day, end_approx = excluded.end_approx,
  end_qualifier = excluded.end_qualifier,
  source = excluded.source, note = excluded.note, tags = excluded.tags;`);
} else {
  console.error(`Naimportovatelných záznamů: ${zaznamy.length} (vynecháno ${zdroj.length - zaznamy.length} duplicit)`);
  console.error(`Rozsahů: ${zaznamy.filter((z) => z.type === 'range').length}, bodů: ${zaznamy.filter((z) => z.type === 'point').length}`);
  console.error(`S otevřenou hranicí: ${zaznamy.filter((z) => z.start.qualifier || z.end?.qualifier).length}`);
}
