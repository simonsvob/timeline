/**
 * Časový model aplikace.
 *
 * Roky se interně drží v ASTRONOMICKÉM číslování:
 *   1 př. n. l. = 0, 2 př. n. l. = -1, 1512 př. n. l. = -1511, 1 n. l. = 1.
 * Rok nula historicky neexistuje – astronomické číslování ho zavádí proto, aby
 * aritmetika (rozdíly let, škálování na ose) fungovala bez výjimek přes přelom
 * letopočtu. Převod na letopočet „př. n. l. / n. l." se děje výhradně ve
 * zobrazovací a vstupní vrstvě, viz `formatYear` / `toAstronomicalYear`.
 *
 * Záměrně se nepoužívá JS `Date`: neumí spolehlivě roky př. n. l. a vnucuje
 * přesnost (čas, časové pásmo), kterou historické údaje nemají.
 */

export type Era = 'bc' | 'ad';

/** Co je u údaje skutečně vyplněno. Nezávislé na tom, zda je údaj jistý. */
export type Precision = 'year' | 'month' | 'day';

/**
 * Otevřený údaj – hranice není známá, ví se jen, na které straně zadaného roku
 * leží:
 *   'min'    … „žil nejméně do" – rok úmrtí není znám (otevřeno doprava)
 *   'after'  … „po roce" – nastalo někdy potom (otevřeno doprava)
 *   'before' … „před rokem" – nastalo někdy předtím (otevřeno doleva)
 *
 * Je to TŘETÍ vlastnost, nezávislá na přesnosti i na jistotě. „min. 64 n. l."
 * není totéž co „~64 n. l.": první říká, že rok neznáme a je aspoň 64, druhé
 * že rok odhadujeme na 64. Proto se nesmí slévat do `approx`.
 */
export type Qualifier = 'min' | 'after' | 'before';

/** Na kterou stranu je údaj otevřený. */
export function openDirection(qualifier: Qualifier | null): 'left' | 'right' | null {
  if (qualifier === 'before') return 'left';
  if (qualifier === 'min' || qualifier === 'after') return 'right';
  return null;
}

/**
 * Jeden časový údaj: přesnost (co je vyplněno), jistota (`approx`)
 * a otevřenost (`qualifier`) – tři nezávislé vlastnosti.
 */
export interface TimePoint {
  /** astronomický rok */
  year: number;
  /** 1–12, nebo null když je zadán jen rok */
  month: number | null;
  /** 1–31, nebo null když není zadán den */
  day: number | null;
  /** přibližné („cca") – nezávislé na přesnosti */
  approx: boolean;
  /** otevřená hranice („min." / „po roce") – nezávislá na obojím */
  qualifier: Qualifier | null;
}

/** Který okraj časového údaje nás zajímá při převodu na spojitou osu. */
export type Edge = 'start' | 'end';

// ---------------------------------------------------------------------------
// Astronomické roky <-> letopočet
// ---------------------------------------------------------------------------

/**
 * Rok letopočtu (kladné číslo) + éra -> astronomický rok.
 * 1 př. n. l. -> 0, 2 př. n. l. -> -1, 1 n. l. -> 1.
 */
export function toAstronomicalYear(yearInEra: number, era: Era): number {
  if (!Number.isInteger(yearInEra) || yearInEra < 1) {
    throw new RangeError(`Rok letopočtu musí být celé číslo >= 1, dostal jsem ${yearInEra}`);
  }
  return era === 'ad' ? yearInEra : 1 - yearInEra;
}

/** Astronomický rok -> rok letopočtu (kladné číslo) + éra. */
export function fromAstronomicalYear(astronomicalYear: number): { year: number; era: Era } {
  return astronomicalYear <= 0
    ? { year: 1 - astronomicalYear, era: 'bc' }
    : { year: astronomicalYear, era: 'ad' };
}

/**
 * Počet let mezi dvěma astronomickými roky (b - a).
 * Díky astronomickému číslování funguje i přes přelom letopočtu bez korekce:
 * z 1 př. n. l. (0) do 1 n. l. (1) je rozdíl 1 rok.
 */
export function yearDifference(fromYear: number, toYear: number): number {
  return toYear - fromYear;
}

// ---------------------------------------------------------------------------
// Spojitá osa
// ---------------------------------------------------------------------------

/**
 * Délky měsíců pro účely vykreslení. Součet 365 – přestupné roky se záměrně
 * neřeší, stejně jako se neřeší juliánský/gregoriánský kalendář: údaje se
 * ukládají a zobrazují tak, jak byly zadány. Slouží výhradně k umístění
 * značky na ose, nikoli k výpočtu skutečných dat.
 */
export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
export const DAYS_IN_YEAR = 365;

export function daysInMonth(month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Měsíc musí být 1–12, dostal jsem ${month}`);
  }
  return MONTH_LENGTHS[month - 1];
}

/** Pořadí dne v roce (1–365) podle modelu výše. */
export function dayOfYear(month: number, day: number): number {
  const len = daysInMonth(month);
  if (!Number.isInteger(day) || day < 1 || day > len) {
    throw new RangeError(`Den ${day} neexistuje v měsíci ${month}`);
  }
  let sum = 0;
  for (let m = 1; m < month; m++) sum += MONTH_LENGTHS[m - 1];
  return sum + day;
}

/** Přesnost údaje odvozená z vyplněných polí. */
export function precisionOf(month: number | null, day: number | null): Precision {
  if (month == null) return 'year';
  return day == null ? 'month' : 'day';
}

export function precisionOfPoint(tp: Pick<TimePoint, 'month' | 'day'>): Precision {
  return precisionOf(tp.month, tp.day);
}

/**
 * Převod časového údaje na spojitou souřadnici osy (zlomkový astronomický rok).
 *
 * Údaj se chápe jako interval odpovídající své přesnosti:
 *   „607 př. n. l."      -> celý rok
 *   „říjen 607 př. n. l." -> celý měsíc
 *   „7. října 607"        -> celý den
 * `edge: 'start'` vrací začátek intervalu, `edge: 'end'` jeho konec.
 */
export function toContinuous(tp: Pick<TimePoint, 'year' | 'month' | 'day'>, edge: Edge): number {
  const { year, month, day } = tp;
  if (month == null) {
    return edge === 'start' ? year : year + 1;
  }
  if (day == null) {
    const first = dayOfYear(month, 1);
    const last = dayOfYear(month, daysInMonth(month));
    return edge === 'start' ? year + (first - 1) / DAYS_IN_YEAR : year + last / DAYS_IN_YEAR;
  }
  const doy = dayOfYear(month, day);
  return edge === 'start' ? year + (doy - 1) / DAYS_IN_YEAR : year + doy / DAYS_IN_YEAR;
}

/** Střed intervalu daného údaje – pozice bodové značky na ose. */
export function toContinuousCenter(tp: Pick<TimePoint, 'year' | 'month' | 'day'>): number {
  return (toContinuous(tp, 'start') + toContinuous(tp, 'end')) / 2;
}

/**
 * Porovnání dvou údajů podle nejranějšího možného okamžiku.
 * Vrací záporné číslo, nulu nebo kladné číslo (jako comparator).
 */
export function compareTimePoints(
  a: Pick<TimePoint, 'year' | 'month' | 'day'>,
  b: Pick<TimePoint, 'year' | 'month' | 'day'>,
): number {
  if (a.year !== b.year) return a.year - b.year;
  const am = a.month ?? 1;
  const bm = b.month ?? 1;
  if (am !== bm) return am - bm;
  return (a.day ?? 1) - (b.day ?? 1);
}
