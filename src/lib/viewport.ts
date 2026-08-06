/**
 * Matematika výřezu osy a adaptivní měřítko.
 *
 * Výřez je popsán dvojicí: `t0` = spojitý (zlomkový astronomický) rok na
 * levém okraji plátna a `pxPerYear` = počet pixelů na jeden rok. Zoom je
 * spojitý, od celého rozsahu tisíciletí až po jednotlivé dny.
 */

import { formatYear, monthName, monthNameGenitive } from './format';
import { DAYS_IN_YEAR, daysInMonth } from './time';

export interface Viewport {
  /** spojitý rok na x = 0 */
  t0: number;
  /** pixelů na rok */
  pxPerYear: number;
  /** šířka plátna v CSS pixelech */
  width: number;
}

export interface Domain {
  min: number;
  max: number;
}

/** Výchozí rozsah, když ještě nejsou žádná data: ~4200 př. n. l. – 200 n. l. */
export const DEFAULT_DOMAIN: Domain = { min: -4200, max: 200 };

/** Nejtěsnější přiblížení: jeden den zabere zhruba tolik pixelů. */
export const MAX_PX_PER_DAY = 60;

export function xOf(view: Viewport, t: number): number {
  return (t - view.t0) * view.pxPerYear;
}

export function tOf(view: Viewport, x: number): number {
  return view.t0 + x / view.pxPerYear;
}

/** Spojitý rok na pravém okraji. */
export function viewEnd(view: Viewport): number {
  return tOf(view, view.width);
}

export function minPxPerYear(domain: Domain, width: number): number {
  const span = Math.max(domain.max - domain.min, 1);
  return width / span;
}

export function maxPxPerYear(): number {
  return MAX_PX_PER_DAY * DAYS_IN_YEAR;
}

/**
 * Ohlídá, aby výřez nevyjel mimo rozsah dat a aby zoom zůstal v mezích.
 * Když se celý rozsah vejde na plátno, výřez se na něj přilepí.
 */
export function clampViewport(view: Viewport, domain: Domain): Viewport {
  const minScale = minPxPerYear(domain, view.width);
  const pxPerYear = Math.min(Math.max(view.pxPerYear, minScale), maxPxPerYear());
  const visibleYears = view.width / pxPerYear;
  const span = domain.max - domain.min;

  let t0 = view.t0;
  if (visibleYears >= span) {
    // vejde se všechno – vycentrovat rozsah
    t0 = domain.min - (visibleYears - span) / 2;
  } else {
    t0 = Math.min(Math.max(t0, domain.min), domain.max - visibleYears);
  }
  return { t0, pxPerYear, width: view.width };
}

/** Zoom kolem pevného bodu na plátně (kurzor myši / střed gesta). */
export function zoomAt(view: Viewport, anchorX: number, factor: number, domain: Domain): Viewport {
  const anchorT = tOf(view, anchorX);
  const pxPerYear = view.pxPerYear * factor;
  const next: Viewport = { ...view, pxPerYear };
  // anchorT musí zůstat pod stejným pixelem
  next.t0 = anchorT - anchorX / next.pxPerYear;
  return clampViewport(next, domain);
}

/** Posun o pixely (tažení). */
export function panBy(view: Viewport, dxPixels: number, domain: Domain): Viewport {
  return clampViewport({ ...view, t0: view.t0 - dxPixels / view.pxPerYear }, domain);
}

/** Výřez, který ukáže zadaný interval (s okrajem). */
export function viewportForRange(
  from: number,
  to: number,
  width: number,
  domain: Domain,
  paddingRatio = 0.15,
): Viewport {
  const rawSpan = Math.max(to - from, 1 / DAYS_IN_YEAR);
  const span = rawSpan * (1 + paddingRatio * 2);
  const center = (from + to) / 2;
  const pxPerYear = width / span;
  return clampViewport({ t0: center - span / 2, pxPerYear, width }, domain);
}

// ---------------------------------------------------------------------------
// Měřítko
// ---------------------------------------------------------------------------

export type TickUnit = 'year' | 'month' | 'day';

export interface TickLevel {
  unit: TickUnit;
  /** krok v jednotkách `unit` */
  step: number;
}

export interface Tick {
  /** pozice na spojité ose */
  t: number;
  label: string;
  /** hlavní dělení (silnější linka, výraznější popisek) */
  major: boolean;
}

/**
 * Všechna dělení od nejjemnějšího po nejhrubší. Mezistupně (15/10/5 dní,
 * 6/3 měsíce) vyplňují přechod mezi jednotkami, aby zahušťování bylo plynulé:
 * tisíciletí → staletí → dekády → roky → měsíce → dny.
 */
const TICK_LEVELS: TickLevel[] = [
  { unit: 'day', step: 1 },
  { unit: 'day', step: 2 },
  { unit: 'day', step: 5 },
  { unit: 'day', step: 10 },
  { unit: 'day', step: 15 },
  { unit: 'month', step: 1 },
  { unit: 'month', step: 3 },
  { unit: 'month', step: 6 },
  { unit: 'year', step: 1 },
  { unit: 'year', step: 2 },
  { unit: 'year', step: 5 },
  { unit: 'year', step: 10 },
  { unit: 'year', step: 25 },
  { unit: 'year', step: 50 },
  { unit: 'year', step: 100 },
  { unit: 'year', step: 250 },
  { unit: 'year', step: 500 },
  { unit: 'year', step: 1000 },
];

const COARSEST_LEVEL = TICK_LEVELS[TICK_LEVELS.length - 1];

/** Šířka jednoho kroku dělení v pixelech. */
function levelWidthPx(level: TickLevel, pxPerYear: number): number {
  switch (level.unit) {
    case 'day':
      return (level.step * pxPerYear) / DAYS_IN_YEAR;
    case 'month':
      return (level.step * pxPerYear) / 12;
    case 'year':
      return level.step * pxPerYear;
  }
}

/**
 * Vybere nejjemnější dělení, jehož rozestup je aspoň `minSpacing` pixelů.
 * Když se ani nejhrubší nevejde (maximální oddálení), použije se nejhrubší.
 */
export function chooseTickLevel(pxPerYear: number, minSpacing = 96): TickLevel {
  for (const level of TICK_LEVELS) {
    if (levelWidthPx(level, pxPerYear) >= minSpacing) return level;
  }
  return COARSEST_LEVEL;
}

/** Pozice prvního dne měsíce na spojité ose. */
function monthStart(year: number, month: number): number {
  let days = 0;
  for (let m = 1; m < month; m++) days += daysInMonth(m);
  return year + days / DAYS_IN_YEAR;
}

function dayStart(year: number, month: number, day: number): number {
  return monthStart(year, month) + (day - 1) / DAYS_IN_YEAR;
}

const MAX_TICKS = 400;

/**
 * Vygeneruje popisky měřítka pro viditelný výřez (plus malý přesah).
 * Roky se vždy formátují s érou („607 př. n. l."), měsíce a dny česky.
 */
export function generateTicks(view: Viewport, minSpacing = 96): Tick[] {
  const level = chooseTickLevel(view.pxPerYear, minSpacing);
  const from = tOf(view, -minSpacing);
  const to = tOf(view, view.width + minSpacing);
  const ticks: Tick[] = [];

  if (level.unit === 'year') {
    const step = level.step;
    const first = Math.floor(from / step) * step;
    let previous: number | null = null;
    // O krok širší rozsah, aby dělení vždy přesahovalo oba okraje výřezu
    for (let base = first - step; base <= to + step && ticks.length < MAX_TICKS; base += step) {
      // Dělení se zarovnává na kulaté roky LETOPOČTU, ne na kulaté astronomické
      // hodnoty – uživatel čeká „4000 př. n. l.", ne „4001 př. n. l.".
      // Pro rok <= 0 je zobrazený rok 1 - y, proto posun o jedničku.
      const y = base <= 0 ? base + 1 : base;
      if (y === previous) continue;
      previous = y;
      ticks.push({
        t: y,
        label: formatYear(y),
        // hlavní dělení: kulaté násobky vyššího řádu, vždy přelom letopočtu
        major: y === 1 || (step >= 100 ? base % (step * 5) === 0 : base % (step * 10) === 0),
      });
    }
    return ticks;
  }

  if (level.unit === 'month') {
    const firstYear = Math.floor(from);
    const lastYear = Math.floor(to);
    for (let y = firstYear; y <= lastYear && ticks.length < MAX_TICKS; y++) {
      for (let m = 1; m <= 12 && ticks.length < MAX_TICKS; m += level.step) {
        const t = monthStart(y, m);
        if (t < from || t > to) continue;
        ticks.push({
          t,
          label: m === 1 ? `${monthName(m)} ${formatYear(y)}` : monthName(m),
          major: m === 1,
        });
      }
    }
    return ticks;
  }

  const firstYear = Math.floor(from);
  const lastYear = Math.floor(to);
  for (let y = firstYear; y <= lastYear && ticks.length < MAX_TICKS; y++) {
    for (let m = 1; m <= 12 && ticks.length < MAX_TICKS; m++) {
      const len = daysInMonth(m);
      for (let d = 1; d <= len && ticks.length < MAX_TICKS; d += level.step) {
        const t = dayStart(y, m, d);
        if (t < from || t > to) continue;
        ticks.push({
          t,
          label: d === 1 ? `${d}. ${monthNameGenitive(m)} ${formatYear(y)}` : `${d}. ${monthNameGenitive(m)}`,
          major: d === 1,
        });
      }
    }
  }
  return ticks;
}
