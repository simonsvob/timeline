import { describe, expect, it } from 'vitest';
import {
  chooseTickLevel,
  clampViewport,
  generateTicks,
  limitZoomFactor,
  MAX_ZOOM_RATE,
  panBy,
  tOf,
  type Domain,
  type Viewport,
  viewportForRange,
  xOf,
  zoomAt,
} from './viewport';
import { DAYS_IN_YEAR } from './time';

const domain: Domain = { min: -4200, max: 200 };
const view = (t0: number, pxPerYear: number, width = 1000): Viewport => ({ t0, pxPerYear, width });

describe('převod souřadnic', () => {
  it('je vzájemně inverzní', () => {
    const v = view(-2000, 0.5);
    expect(xOf(v, -2000)).toBe(0);
    expect(tOf(v, 0)).toBe(-2000);
    expect(tOf(v, xOf(v, -1234.5))).toBeCloseTo(-1234.5, 10);
  });
});

describe('zoom', () => {
  it('drží kotevní bod na stejném pixelu', () => {
    const v = clampViewport(view(-2000, 0.5), domain);
    const anchorX = 300;
    const anchorT = tOf(v, anchorX);
    const zoomed = zoomAt(v, anchorX, 2, domain);
    expect(tOf(zoomed, anchorX)).toBeCloseTo(anchorT, 6);
  });

  it('nedovolí oddálit za celý rozsah', () => {
    const zoomed = zoomAt(clampViewport(view(-2000, 1), domain), 500, 0.001, domain);
    expect(zoomed.pxPerYear).toBeCloseTo(1000 / 4400, 10);
  });

  it('dovolí přiblížit až na dny', () => {
    const zoomed = zoomAt(clampViewport(view(-2000, 1), domain), 500, 1e9, domain);
    expect(zoomed.pxPerYear / DAYS_IN_YEAR).toBeGreaterThanOrEqual(50);
  });
});

describe('posun', () => {
  it('posouvá o pixely', () => {
    const v = clampViewport(view(-2000, 1), domain);
    const moved = panBy(v, -100, domain);
    expect(moved.t0).toBeCloseTo(v.t0 + 100, 6);
  });

  it('nevyjede mimo rozsah', () => {
    const v = clampViewport(view(-4200, 1), domain);
    expect(panBy(v, 100000, domain).t0).toBeGreaterThanOrEqual(domain.min - 1e-9);
    const end = panBy(v, -1e6, domain);
    expect(tOf(end, end.width)).toBeLessThanOrEqual(domain.max + 1e-9);
  });
});

describe('výřez na interval', () => {
  it('interval se vejde a je zhruba vycentrovaný', () => {
    const v = viewportForRange(-1511, -1400, 1000, domain);
    expect(v.t0).toBeLessThan(-1511);
    expect(tOf(v, v.width)).toBeGreaterThan(-1400);
  });

  it('zvládne bodový interval (nulová délka)', () => {
    const v = viewportForRange(33, 33, 1000, domain);
    expect(Number.isFinite(v.pxPerYear)).toBe(true);
    expect(v.pxPerYear).toBeGreaterThan(0);
  });
});

describe('měřítko', () => {
  it('se zahušťuje od tisíciletí ke dnům', () => {
    expect(chooseTickLevel(0.1)).toEqual({ unit: 'year', step: 1000 });
    expect(chooseTickLevel(1)).toEqual({ unit: 'year', step: 100 });
    expect(chooseTickLevel(10)).toEqual({ unit: 'year', step: 10 });
    expect(chooseTickLevel(100)).toEqual({ unit: 'year', step: 1 });
    expect(chooseTickLevel(2000).unit).toBe('month');
    expect(chooseTickLevel(60000).unit).toBe('day');
  });

  it('roky na měřítku nesou éru', () => {
    const ticks = generateTicks(view(-2050, 1));
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) {
      expect(tick.label).toMatch(/(př\. n\. l\.|n\. l\.)$/);
    }
  });

  it('popisky měsíců jsou české a rok je jen u ledna', () => {
    const ticks = generateTicks(view(33, 1500));
    const leden = ticks.find((t) => t.label.startsWith('leden'));
    expect(leden?.major).toBe(true);
    expect(leden?.label).toContain('n. l.');
    const jiny = ticks.find((t) => t.label === 'červenec');
    expect(jiny).toBeTruthy();
    expect(jiny?.major).toBe(false);
  });

  it('popisky dnů jsou české a měsíc je ve 2. pádě', () => {
    const ticks = generateTicks(view(33.25, 40000));
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) {
      expect(tick.label).toMatch(/^\d+\. [a-zžščřďťňáéíóúůý]+/);
    }
  });

  it('nevygeneruje nekonečně mnoho popisků', () => {
    expect(generateTicks(view(-4200, 0.001)).length).toBeLessThanOrEqual(400);
    expect(generateTicks(view(0, 1e6)).length).toBeLessThanOrEqual(400);
  });

  it('popisky pokrývají viditelný výřez', () => {
    const v = view(-2000, 1);
    const ticks = generateTicks(v);
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    expect(xOf(v, first.t)).toBeLessThanOrEqual(0);
    expect(xOf(v, last.t)).toBeGreaterThanOrEqual(v.width);
  });
});

describe('strop na rychlosti zoomu', () => {
  it('při běžném snímku propustí mírný zoom beze změny', () => {
    expect(limitZoomFactor(1.02, 16)).toBeCloseTo(1.02, 6);
    expect(limitZoomFactor(1 / 1.02, 16)).toBeCloseTo(1 / 1.02, 6);
  });

  it('prudký pinch ořízne na povolenou rychlost', () => {
    const strop = Math.exp((MAX_ZOOM_RATE * 16) / 1000);
    expect(limitZoomFactor(3, 16)).toBeCloseTo(strop, 6);
    expect(limitZoomFactor(1 / 3, 16)).toBeCloseTo(1 / strop, 6);
  });

  it('dávka setrvačných událostí nepřeletí rozsah', () => {
    // 60 událostí za vteřinu, každá chce zdvojnásobit měřítko
    let mereni = 1;
    for (let i = 0; i < 60; i++) mereni *= limitZoomFactor(2, 1000 / 60);
    expect(mereni).toBeLessThan(Math.exp(MAX_ZOOM_RATE) * 1.01);
    expect(mereni).toBeGreaterThan(10);
  });

  it('dlouhá prodleva nedovolí velký skok', () => {
    expect(limitZoomFactor(100, 5000)).toBeLessThan(1.5);
  });
});
