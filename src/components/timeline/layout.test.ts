import { describe, expect, it } from 'vitest';
import {
  eventExtent,
  fadeWidth,
  hitTest,
  LABEL_PAD,
  layoutEvents,
  MAX_LANES_WITH_LABELS,
  NO_CATEGORY_COLOR,
} from './layout';
import type { Category, TimelineEvent } from '../../data/types';
import { toAstronomicalYear } from '../../lib/time';
import type { Viewport } from '../../lib/viewport';

const measure = (text: string) => text.length * 7;

let counter = 0;
function rangeEvent(
  name: string,
  fromYearBc: number,
  toYearBc: number,
  extra: Partial<TimelineEvent> = {},
): TimelineEvent {
  return {
    id: `e${counter++}`,
    name,
    type: 'range',
    categoryId: null,
    start: { year: toAstronomicalYear(fromYearBc, 'bc'), month: null, day: null, approx: false, qualifier: null },
    end: { year: toAstronomicalYear(toYearBc, 'bc'), month: null, day: null, approx: false, qualifier: null },
    source: null,
    note: null,
    placeName: null,
    lat: null,
    lng: null,
    tags: [],
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

function pointEvent(name: string, yearBc: number, extra: Partial<TimelineEvent> = {}): TimelineEvent {
  return { ...rangeEvent(name, yearBc, yearBc, extra), type: 'point', end: null };
}

const view = (t0: number, pxPerYear: number, width = 1000): Viewport => ({ t0, pxPerYear, width });
const noCategories = new Map<string, Category>();

describe('rozsah záznamu na ose', () => {
  it('rozsah pokrývá celé krajní roky', () => {
    const e = rangeEvent('Metuzalém', 3339, 2370);
    const { from, to } = eventExtent(e);
    expect(to - from).toBeCloseTo(970, 6);
  });

  it('bod je jediný okamžik', () => {
    const { from, to } = eventExtent(pointEvent('Potopa', 2370));
    expect(from).toBe(to);
  });
});

describe('rozvržení popisků', () => {
  it('široký pruh nese popisek uvnitř', () => {
    const layout = layoutEvents([rangeEvent('Šalomoun', 1037, 998)], view(-1100, 10), noCategories, measure);
    const item = layout.items[0];
    expect(item.labelInside).toBe(true);
    expect(item.showLabel).toBe(true);
    expect(item.labelX).toBeGreaterThanOrEqual(item.x1);
    expect(item.labelX + item.labelWidth).toBeLessThanOrEqual(item.x2);
  });

  it('úzký pruh má popisek vpravo vedle sebe', () => {
    const layout = layoutEvents([rangeEvent('Šalomoun', 1037, 1036)], view(-1100, 1), noCategories, measure);
    const item = layout.items[0];
    expect(item.labelInside).toBe(false);
    expect(item.labelX).toBeGreaterThan(item.x2);
  });

  it('bod má popisek vždy vedle značky', () => {
    const layout = layoutEvents([pointEvent('Potopa', 2370)], view(-2400, 1), noCategories, measure);
    expect(layout.items[0].labelInside).toBe(false);
    expect(layout.items[0].labelX).toBeGreaterThan(layout.items[0].centerX);
  });

  it('popisek pruhu delšího než výřez zůstane přilepený u okraje plátna', () => {
    // Metuzalém přes celý výřez: pruh začíná daleko vlevo a končí daleko vpravo
    const layout = layoutEvents([rangeEvent('Metuzalém', 3339, 2370)], view(-2900, 50), noCategories, measure);
    const item = layout.items[0];
    expect(item.x1).toBeLessThan(0);
    expect(item.x2).toBeGreaterThan(1000);
    expect(item.labelInside).toBe(true);
    expect(item.showLabel).toBe(true);
    expect(item.labelX).toBe(LABEL_PAD);
  });

  it('popisek uvnitř pruhu začíná až za náběhem do ztracena', () => {
    const jisty = rangeEvent('Šalomoun', 1037, 998);
    const priblizny = rangeEvent('Šalomoun', 1037, 998, {
      start: { year: toAstronomicalYear(1037, 'bc'), month: null, day: null, approx: true, qualifier: null },
    });
    const v = view(-1100, 10);
    const a = layoutEvents([jisty], v, noCategories, measure).items[0];
    const b = layoutEvents([priblizny], v, noCategories, measure).items[0];

    expect(a.labelInside).toBe(true);
    expect(b.labelInside).toBe(true);
    // přibližný začátek posune popisek doprava přesně o délku náběhu
    expect(b.labelX - a.labelX).toBeCloseTo(fadeWidth(b.x2 - b.x1), 6);
    expect(b.labelX).toBeGreaterThanOrEqual(b.x1 + fadeWidth(b.x2 - b.x1));
  });

  it('popisek nezasahuje do náběhu na konci pruhu', () => {
    const e = rangeEvent('Šalomoun', 1037, 998, {
      end: { year: toAstronomicalYear(998, 'bc'), month: null, day: null, approx: true, qualifier: null },
    });
    const item = layoutEvents([e], view(-1100, 10), noCategories, measure).items[0];
    if (item.labelInside) {
      expect(item.labelX + item.labelWidth).toBeLessThanOrEqual(
        item.x2 - fadeWidth(item.x2 - item.x1) + 0.001,
      );
    }
  });

  it('pruh s náběhy na obou stranách popisek radši vystrčí ven', () => {
    // úzký pruh: po odečtení obou náběhů se text dovnitř nevejde
    const e = rangeEvent('Šalomoun', 1037, 1027, {
      start: { year: toAstronomicalYear(1037, 'bc'), month: null, day: null, approx: true, qualifier: null },
      end: { year: toAstronomicalYear(1027, 'bc'), month: null, day: null, approx: true, qualifier: null },
    });
    const item = layoutEvents([e], view(-1100, 10), noCategories, measure).items[0];
    expect(item.labelInside).toBe(false);
    expect(item.labelX).toBeGreaterThan(item.x2);
  });

  it('popisek u pravého okraje plátna se překlopí doleva od značky', () => {
    // bod těsně u pravého okraje: napravo už není místo na text
    const layout = layoutEvents([pointEvent('Zničení Jeruzaléma', 2000)], view(-2999, 1), noCategories, measure);
    const item = layout.items[0];
    expect(item.centerX).toBeGreaterThan(900);
    expect(item.showLabel).toBe(true);
    expect(item.labelX + item.labelWidth).toBeLessThanOrEqual(view(0, 1).width);
    expect(item.labelX).toBeLessThan(item.x1);
  });

  it('popisek s dostatkem místa vpravo se nepřeklápí', () => {
    const layout = layoutEvents([pointEvent('Potopa', 2370)], view(-2400, 1), noCategories, measure);
    expect(layout.items[0].labelX).toBeGreaterThan(layout.items[0].x2);
  });

  it('popisek nenese vlnovku – přibližnost je vidět z vykreslení', () => {
    const e = pointEvent('Exodus', 1513, {
      start: { year: toAstronomicalYear(1513, 'bc'), month: null, day: null, approx: true, qualifier: null },
    });
    const layout = layoutEvents([e], view(-1600, 1), noCategories, measure);
    expect(layout.items[0].label).toBe('Exodus');
    expect(layout.items[0].startApprox).toBe(true);
  });
});

describe('řádkování', () => {
  it('souběžné životy dostanou vlastní řádky', () => {
    const events = [
      rangeEvent('Adam', 4026, 3096),
      rangeEvent('Set', 3896, 2984),
      rangeEvent('Enoš', 3791, 2886),
    ];
    const layout = layoutEvents(events, view(-4100, 0.2), noCategories, measure);
    const lanes = new Set(layout.items.map((i) => i.lane));
    expect(lanes.size).toBe(3);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('navazující záznamy sdílejí řádek', () => {
    const events = [rangeEvent('A', 4000, 3900), rangeEvent('B', 3000, 2900)];
    const layout = layoutEvents(events, view(-4100, 1), noCategories, measure);
    expect(new Set(layout.items.map((i) => i.lane)).size).toBe(1);
  });

  it('při přeplnění přestane rezervovat místo pro popisky a skryje je', () => {
    // 200 bodů namačkaných na sebe -> s popisky by vzniklo přes MAX_LANES řádků
    const events = Array.from({ length: 200 }, (_, i) => pointEvent(`Záznam číslo ${i}`, 2000 - i));
    const dense = layoutEvents(events, view(-2100, 0.2), noCategories, measure);
    expect(dense.labelsReserved).toBe(false);
    expect(dense.items.some((i) => !i.showLabel)).toBe(true);

    // ve zhuštěném režimu je rozvržení stejné, jako by popisky neexistovaly
    const withoutLabels = layoutEvents(events, view(-2100, 0.2), noCategories, () => 0);
    expect(dense.laneCount).toBe(withoutLabels.laneCount);
    expect(dense.laneCount).toBeLessThan(events.length);
  });

  it('při rozumné hustotě se místo pro popisky rezervuje', () => {
    // záznamy pohodlně uvnitř výřezu, aby žádný popisek nenarazil na okraj
    const events = Array.from({ length: 8 }, (_, i) => pointEvent(`Záznam ${i}`, 2000 - i * 100));
    const layout = layoutEvents(events, view(-2100, 1), noCategories, measure);
    expect(layout.labelsReserved).toBe(true);
    expect(layout.laneCount).toBeLessThanOrEqual(MAX_LANES_WITH_LABELS);
    expect(layout.items.every((i) => i.showLabel)).toBe(true);
  });
});

describe('pásma', () => {
  it('bodové události leží nad rozsahy', () => {
    const events = [
      rangeEvent('Adam', 4026, 3096),
      pointEvent('Potopa', 2370),
      rangeEvent('Noe', 2970, 2020),
      pointEvent('Exodus', 1513),
    ];
    const layout = layoutEvents(events, view(-4100, 0.2), noCategories, measure);
    const lane = (name: string) => layout.items.find((i) => i.event.name === name)!.lane;
    const nejnizsiBod = Math.max(lane('Potopa'), lane('Exodus'));
    const nejvyssiRozsah = Math.min(lane('Adam'), lane('Noe'));
    expect(nejnizsiBod).toBeLessThan(nejvyssiRozsah);
    expect(layout.pointLaneCount).toBeGreaterThan(0);
  });

  it('mezi pásmy je prázdný řádek', () => {
    const layout = layoutEvents(
      [pointEvent('Potopa', 2370), rangeEvent('Noe', 2970, 2020)],
      view(-3000, 0.2),
      noCategories,
      measure,
    );
    const bod = layout.items.find((i) => i.isPoint)!;
    const rozsah = layout.items.find((i) => !i.isPoint)!;
    expect(rozsah.lane).toBe(bod.lane + 2);
  });

  it('samotné rozsahy začínají hned nahoře', () => {
    const layout = layoutEvents([rangeEvent('Noe', 2970, 2020)], view(-3000, 0.2), noCategories, measure);
    expect(layout.pointLaneCount).toBe(0);
    expect(layout.items[0].lane).toBe(0);
  });
});

describe('barvy', () => {
  it('bere barvu z kategorie', () => {
    const categories = new Map<string, Category>([
      ['c1', { id: 'c1', name: 'Patriarchové', color: '#a2563c', sortOrder: 0 }],
    ]);
    const layout = layoutEvents(
      [pointEvent('Potopa', 2370, { categoryId: 'c1' }), pointEvent('Jiné', 2000)],
      view(-2400, 1),
      categories,
      measure,
    );
    expect(layout.items[0].color).toBe('#a2563c');
    expect(layout.items[1].color).toBe(NO_CATEGORY_COLOR);
  });
});

describe('zásah kliknutím', () => {
  it('trefí záznam ve správném řádku', () => {
    const events = [rangeEvent('Adam', 4026, 3096), rangeEvent('Set', 3896, 2984)];
    const layout = layoutEvents(events, view(-4100, 0.5), noCategories, measure);
    const target = layout.items[1];
    const y = target.lane * 30 + 15;
    expect(hitTest(layout, target.centerX, y, 0)?.event.id).toBe(target.event.id);
  });

  it('mimo záznam vrací null', () => {
    const layout = layoutEvents([rangeEvent('Adam', 4026, 3096)], view(-4100, 0.5), noCategories, measure);
    expect(hitTest(layout, 999, 15, 0)).toBeNull();
    expect(hitTest(layout, layout.items[0].centerX, 5000, 0)).toBeNull();
  });

  it('kratší záznam vyhrává nad dlouhým pruhem', () => {
    const long = rangeEvent('Dlouhý', 4000, 2000);
    const short = pointEvent('Krátký', 3000);
    const layout = layoutEvents([long, short], view(-4100, 0.5), noCategories, measure);
    const shortGeom = layout.items.find((i) => i.event.id === short.id)!;
    // uměle je dáme do stejného řádku
    const merged = { ...layout, items: layout.items.map((i) => ({ ...i, lane: 0 })) };
    const hit = hitTest(merged, shortGeom.centerX, 15, 0);
    expect(hit?.event.id).toBe(short.id);
  });
});
