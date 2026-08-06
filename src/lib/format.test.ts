import { describe, expect, it } from 'vitest';
import {
  formatRange,
  formatTimePoint,
  formatTimePointBare,
  formatYear,
  isRangeApprox,
  rangeLengthYears,
} from './format';
import { toAstronomicalYear, type TimePoint } from './time';

const tp = (
  year: number,
  era: 'bc' | 'ad',
  month: number | null = null,
  day: number | null = null,
  approx = false,
): TimePoint => ({ year: toAstronomicalYear(year, era), month, day, approx });

describe('formátování roku', () => {
  it('rozlišuje éry', () => {
    expect(formatYear(-1511)).toBe('1512 př. n. l.');
    expect(formatYear(0)).toBe('1 př. n. l.');
    expect(formatYear(1)).toBe('1 n. l.');
    expect(formatYear(33)).toBe('33 n. l.');
    expect(formatYear(-4025)).toBe('4026 př. n. l.');
  });
});

describe('formátování podle přesnosti', () => {
  it('jen rok zobrazí jen rok', () => {
    expect(formatTimePoint(tp(607, 'bc'))).toBe('607 př. n. l.');
  });

  it('rok + měsíc zobrazí měsíc v 1. pádě', () => {
    expect(formatTimePoint(tp(607, 'bc', 10))).toBe('říjen 607 př. n. l.');
    expect(formatTimePoint(tp(33, 'ad', 4))).toBe('duben 33 n. l.');
  });

  it('plné datum zobrazí den a měsíc ve 2. pádě', () => {
    expect(formatTimePoint(tp(607, 'bc', 10, 7))).toBe('7. října 607 př. n. l.');
    expect(formatTimePoint(tp(33, 'ad', 4, 14))).toBe('14. dubna 33 n. l.');
  });

  it('nikdy nedoplní přesnost, která nebyla zadána', () => {
    // záznam „rok −606" se nesmí ukázat jako „1. 1. 607 př. n. l."
    const jenRok = formatTimePoint(tp(607, 'bc'));
    expect(jenRok).toBe('607 př. n. l.');
    expect(jenRok).not.toMatch(/\d+\.\s/);
    expect(jenRok).not.toMatch(/led|úno|bře|dub|kvě|čer|srp|září|říj|list|pros/);

    const rokMesic = formatTimePoint(tp(607, 'bc', 10));
    expect(rokMesic).toBe('říjen 607 př. n. l.');
    expect(rokMesic).not.toMatch(/^\d+\./);
  });
});

describe('formátování podle jistoty', () => {
  it('přibližný údaj uvozuje vlnovkou', () => {
    expect(formatTimePoint(tp(1450, 'bc', null, null, true))).toBe('~1450 př. n. l.');
  });

  it('jistý údaj vlnovku nemá', () => {
    expect(formatTimePoint(tp(1512, 'bc'))).toBe('1512 př. n. l.');
  });

  it('jistota je nezávislá na přesnosti', () => {
    // přesné a jisté
    expect(formatTimePoint(tp(33, 'ad', 4, 14))).toBe('14. dubna 33 n. l.');
    // přesné, ale přibližné
    expect(formatTimePoint(tp(33, 'ad', 4, 14, true))).toBe('~14. dubna 33 n. l.');
    // jen rok, ale jisté
    expect(formatTimePoint(tp(1512, 'bc'))).toBe('1512 př. n. l.');
    // jen rok a přibližné
    expect(formatTimePoint(tp(1450, 'bc', null, null, true))).toBe('~1450 př. n. l.');
  });

  it('varianta bez značky nejistoty vlnovku vynechá', () => {
    expect(formatTimePointBare(tp(1450, 'bc', null, null, true))).toBe('1450 př. n. l.');
  });
});

describe('formátování rozsahu', () => {
  it('spojuje obě strany pomlčkou', () => {
    expect(formatRange(tp(1512, 'bc'), tp(1406, 'bc'))).toBe('1512 př. n. l. – 1406 př. n. l.');
  });

  it('každá strana nese vlastní jistotu i přesnost', () => {
    expect(formatRange(tp(1450, 'bc', null, null, true), tp(1410, 'bc', 3))).toBe(
      '~1450 př. n. l. – březen 1410 př. n. l.',
    );
  });

  it('rozsah přes přelom letopočtu', () => {
    expect(formatRange(tp(4, 'bc'), tp(33, 'ad'))).toBe('4 př. n. l. – 33 n. l.');
  });

  it('bez konce vrátí jen začátek', () => {
    expect(formatRange(tp(33, 'ad'), null)).toBe('33 n. l.');
  });
});

describe('délka rozsahu', () => {
  it('počítá roky přes přelom letopočtu bez korekce', () => {
    // z 1 př. n. l. do 1 n. l. uplynul 1 rok (rok nula neexistuje)
    expect(rangeLengthYears(tp(1, 'bc'), tp(1, 'ad'))).toBeCloseTo(1, 10);
    expect(rangeLengthYears(tp(2, 'bc'), tp(2, 'ad'))).toBeCloseTo(3, 10);
  });

  it('délka Metuzalémova života je 969 let', () => {
    expect(rangeLengthYears(tp(3339, 'bc'), tp(2370, 'bc'))).toBeCloseTo(969, 10);
  });

  it('babylonské zajetí trvalo 70 let', () => {
    expect(rangeLengthYears(tp(607, 'bc'), tp(537, 'bc'))).toBeCloseTo(70, 10);
  });

  it('respektuje měsíce a dny', () => {
    const length = rangeLengthYears(tp(29, 'ad', 10), tp(33, 'ad', 4, 14));
    expect(length).toBeGreaterThan(3.4);
    expect(length).toBeLessThan(3.6);
  });

  it('bez konce vrací null', () => {
    expect(rangeLengthYears(tp(33, 'ad'), null)).toBeNull();
  });
});

describe('nejistota rozsahu', () => {
  it('stačí jedna přibližná strana', () => {
    expect(isRangeApprox(tp(1450, 'bc', null, null, true), tp(1410, 'bc'))).toBe(true);
    expect(isRangeApprox(tp(1450, 'bc'), tp(1410, 'bc', null, null, true))).toBe(true);
    expect(isRangeApprox(tp(1450, 'bc'), tp(1410, 'bc'))).toBe(false);
    expect(isRangeApprox(tp(1450, 'bc'), null)).toBe(false);
  });
});
