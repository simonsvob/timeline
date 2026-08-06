/**
 * Formátování časových údajů do češtiny.
 *
 * Klíčové pravidlo: nikdy nezobrazuj přesnost, která nebyla zadána.
 * Záznam „rok −606" se nesmí ukázat jako „1. 1. 607 př. n. l." – zobrazí se
 * jako „607 př. n. l.". Jistota (`approx`) je vlastnost nezávislá na přesnosti
 * a projeví se předsazenou vlnovkou: „~1450 př. n. l.".
 */

import { cs } from '../i18n/cs';
import { fromAstronomicalYear, precisionOf, toContinuous, type TimePoint } from './time';

export const APPROX_PREFIX = '~';
export const RANGE_SEPARATOR = ' – ';

/** Astronomický rok -> „607 př. n. l." / „33 n. l.". */
export function formatYear(astronomicalYear: number): string {
  const { year, era } = fromAstronomicalYear(astronomicalYear);
  return `${year} ${era === 'bc' ? cs.era.bc : cs.era.ad}`;
}

/** Jen číslo roku v letopočtu, bez éry (pro hustá měřítka a formuláře). */
export function formatYearNumber(astronomicalYear: number): string {
  return String(fromAstronomicalYear(astronomicalYear).year);
}

/** Název měsíce v 1. pádě: „říjen". */
export function monthName(month: number): string {
  return cs.months.nominative[month - 1];
}

/** Název měsíce ve 2. pádě pro plné datum: „7. října". */
export function monthNameGenitive(month: number): string {
  return cs.months.genitive[month - 1];
}

/**
 * Formátuje časový údaj přesně podle zadané přesnosti a jistoty:
 *   jen rok        -> „607 př. n. l."
 *   rok + měsíc    -> „říjen 607 př. n. l."
 *   rok + měsíc+den -> „7. října 607 př. n. l."
 * Přibližný údaj dostane předponu „~".
 */
export function formatTimePoint(tp: TimePoint): string {
  const prefix = tp.approx ? APPROX_PREFIX : '';
  return prefix + formatTimePointBare(tp);
}

/** Totéž bez značky nejistoty (když ji vykresluje UI jinak). */
export function formatTimePointBare(tp: Pick<TimePoint, 'year' | 'month' | 'day'>): string {
  const year = formatYear(tp.year);
  switch (precisionOf(tp.month, tp.day)) {
    case 'year':
      return year;
    case 'month':
      return `${monthName(tp.month as number)} ${year}`;
    case 'day':
      return `${tp.day}. ${monthNameGenitive(tp.month as number)} ${year}`;
  }
}

/** Rozsah: „1512 př. n. l. – 1406 př. n. l.", každá strana s vlastní jistotou. */
export function formatRange(start: TimePoint, end: TimePoint | null): string {
  const from = formatTimePoint(start);
  if (!end) return from;
  return `${from}${RANGE_SEPARATOR}${formatTimePoint(end)}`;
}

/**
 * Kolik let uplynulo od začátku do konce rozsahu. Vrací null, pokud rozsah
 * nemá konec.
 *
 * Počítá se jako rozdíl začátků obou údajů, ne jako počet dotčených roků:
 * „607 př. n. l. – 537 př. n. l." je 70 let (ne 71) a život „3339 př. n. l. –
 * 2370 př. n. l." je 969 let. Díky spojité ose to funguje i pro měsíce a dny
 * a bez výjimky přes přelom letopočtu.
 */
export function rangeLengthYears(start: TimePoint, end: TimePoint | null): number | null {
  if (!end) return null;
  return toContinuous(end, 'start') - toContinuous(start, 'start');
}

/** Je alespoň jedna strana rozsahu přibližná? */
export function isRangeApprox(start: TimePoint, end: TimePoint | null): boolean {
  return start.approx || (end?.approx ?? false);
}
