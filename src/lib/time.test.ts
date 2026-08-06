import { describe, expect, it } from 'vitest';
import {
  compareTimePoints,
  DAYS_IN_YEAR,
  dayOfYear,
  daysInMonth,
  fromAstronomicalYear,
  MONTH_LENGTHS,
  precisionOf,
  toAstronomicalYear,
  toContinuous,
  toContinuousCenter,
  yearDifference,
} from './time';

describe('astronomické číslování roků', () => {
  it('převádí letopočet na astronomický rok', () => {
    expect(toAstronomicalYear(1, 'bc')).toBe(0);
    expect(toAstronomicalYear(2, 'bc')).toBe(-1);
    expect(toAstronomicalYear(1512, 'bc')).toBe(-1511);
    expect(toAstronomicalYear(4026, 'bc')).toBe(-4025);
    expect(toAstronomicalYear(1, 'ad')).toBe(1);
    expect(toAstronomicalYear(33, 'ad')).toBe(33);
  });

  it('převádí astronomický rok zpět na letopočet', () => {
    expect(fromAstronomicalYear(0)).toEqual({ year: 1, era: 'bc' });
    expect(fromAstronomicalYear(-1)).toEqual({ year: 2, era: 'bc' });
    expect(fromAstronomicalYear(-1511)).toEqual({ year: 1512, era: 'bc' });
    expect(fromAstronomicalYear(1)).toEqual({ year: 1, era: 'ad' });
    expect(fromAstronomicalYear(33)).toEqual({ year: 33, era: 'ad' });
  });

  it('je vzájemně inverzní na celém rozsahu dat', () => {
    for (let y = -4200; y <= 200; y++) {
      const { year, era } = fromAstronomicalYear(y);
      expect(toAstronomicalYear(year, era)).toBe(y);
    }
  });

  it('odmítne nekladný rok letopočtu (rok 0 neexistuje)', () => {
    expect(() => toAstronomicalYear(0, 'ad')).toThrow();
    expect(() => toAstronomicalYear(0, 'bc')).toThrow();
    expect(() => toAstronomicalYear(-5, 'ad')).toThrow();
    expect(() => toAstronomicalYear(1.5, 'ad')).toThrow();
  });

  it('nikdy nevrací astronomický rok, který by odpovídal roku 0 letopočtu', () => {
    // 1 př. n. l. = 0 je legitimní astronomická hodnota, ale letopočet 0 ne
    expect(fromAstronomicalYear(0).year).toBe(1);
    expect(fromAstronomicalYear(0).era).toBe('bc');
  });
});

describe('rozdíly let přes přelom letopočtu', () => {
  it('1 př. n. l. bezprostředně předchází 1 n. l.', () => {
    const bc1 = toAstronomicalYear(1, 'bc'); // 0
    const ad1 = toAstronomicalYear(1, 'ad'); // 1
    expect(yearDifference(bc1, ad1)).toBe(1);
  });

  it('počítá rozdíl bez korekce na neexistující rok 0', () => {
    // z 2 př. n. l. do 2 n. l. jsou 3 roky (2 př., 1 př., 1 n. l. -> 2 n. l.)
    expect(yearDifference(toAstronomicalYear(2, 'bc'), toAstronomicalYear(2, 'ad'))).toBe(3);
    // z 1512 př. n. l. do 33 n. l.
    expect(yearDifference(toAstronomicalYear(1512, 'bc'), toAstronomicalYear(33, 'ad'))).toBe(1544);
    // uvnitř jedné éry
    expect(yearDifference(toAstronomicalYear(607, 'bc'), toAstronomicalYear(537, 'bc'))).toBe(70);
    expect(yearDifference(toAstronomicalYear(30, 'ad'), toAstronomicalYear(100, 'ad'))).toBe(70);
  });

  it('rozdíl je záporný při obráceném pořadí', () => {
    expect(yearDifference(toAstronomicalYear(1, 'ad'), toAstronomicalYear(1, 'bc'))).toBe(-1);
  });
});

describe('přesnost', () => {
  it('se odvozuje z vyplněných polí', () => {
    expect(precisionOf(null, null)).toBe('year');
    expect(precisionOf(10, null)).toBe('month');
    expect(precisionOf(10, 7)).toBe('day');
  });
});

describe('kalendářní model pro vykreslení', () => {
  it('má 365 dní', () => {
    expect(MONTH_LENGTHS.reduce((a, b) => a + b, 0)).toBe(DAYS_IN_YEAR);
  });

  it('zná délky měsíců', () => {
    expect(daysInMonth(1)).toBe(31);
    expect(daysInMonth(2)).toBe(28);
    expect(daysInMonth(10)).toBe(31);
    expect(() => daysInMonth(0)).toThrow();
    expect(() => daysInMonth(13)).toThrow();
  });

  it('počítá pořadí dne v roce', () => {
    expect(dayOfYear(1, 1)).toBe(1);
    expect(dayOfYear(2, 1)).toBe(32);
    expect(dayOfYear(12, 31)).toBe(365);
    expect(() => dayOfYear(2, 30)).toThrow();
  });
});

describe('převod na spojitou osu', () => {
  it('rok bez měsíce zabírá celý rok', () => {
    const tp = { year: -1511, month: null, day: null };
    expect(toContinuous(tp, 'start')).toBe(-1511);
    expect(toContinuous(tp, 'end')).toBe(-1510);
  });

  it('měsíc zabírá celý měsíc', () => {
    const tp = { year: 33, month: 1, day: null };
    expect(toContinuous(tp, 'start')).toBe(33);
    expect(toContinuous(tp, 'end')).toBeCloseTo(33 + 31 / 365, 10);
  });

  it('den zabírá jeden den', () => {
    const tp = { year: 33, month: 4, day: 14 };
    const start = toContinuous(tp, 'start');
    const end = toContinuous(tp, 'end');
    expect(end - start).toBeCloseTo(1 / 365, 10);
  });

  it('zachovává uspořádání přes přelom letopočtu', () => {
    const bc1 = toContinuous({ year: 0, month: 12, day: 31 }, 'end');
    const ad1 = toContinuous({ year: 1, month: 1, day: 1 }, 'start');
    expect(bc1).toBeCloseTo(ad1, 10);
    expect(bc1).toBeLessThanOrEqual(ad1);
  });

  it('střed intervalu leží uvnitř intervalu', () => {
    const tp = { year: -606, month: null, day: null };
    const center = toContinuousCenter(tp);
    expect(center).toBeGreaterThan(toContinuous(tp, 'start'));
    expect(center).toBeLessThan(toContinuous(tp, 'end'));
  });
});

describe('porovnání údajů', () => {
  it('řadí podle roku, měsíce a dne', () => {
    const a = { year: -1511, month: null, day: null };
    const b = { year: -1511, month: 3, day: null };
    const c = { year: -1511, month: 3, day: 15 };
    const d = { year: -1510, month: null, day: null };
    expect(compareTimePoints(a, b)).toBeLessThan(0);
    expect(compareTimePoints(b, c)).toBeLessThan(0);
    expect(compareTimePoints(c, d)).toBeLessThan(0);
    expect(compareTimePoints(a, a)).toBe(0);
  });

  it('chybějící měsíc/den se chová jako začátek jednotky', () => {
    expect(compareTimePoints({ year: 5, month: null, day: null }, { year: 5, month: 1, day: 1 })).toBe(0);
  });

  it('řadí správně přes přelom letopočtu', () => {
    expect(compareTimePoints({ year: 0, month: null, day: null }, { year: 1, month: null, day: null }))
      .toBeLessThan(0);
    expect(compareTimePoints({ year: -1, month: null, day: null }, { year: 0, month: null, day: null }))
      .toBeLessThan(0);
  });
});
