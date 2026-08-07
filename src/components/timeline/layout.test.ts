import { describe, expect, it } from 'vitest';
import {
  eventExtent,
  hitTest,
  layoutEvents,
  MAX_POINT_LANES,
  NO_CATEGORY_COLOR,
  pointLaneY,
  rangeLaneY,
  BAR_LABEL_INSET,
} from './layout';
import type { Category, TimelineEvent } from '../../data/types';
import { toAstronomicalYear } from '../../lib/time';
import type { Viewport } from '../../lib/viewport';

const measure = (text: string, weight: 'normal' | 'bold' = 'normal') =>
  text.length * (weight === 'bold' ? 7.7 : 6.2);
const roky = (event: TimelineEvent) => (event.end ? 'roky' : 'rok');
const view = (t0: number, pxPerYear: number, width = 1000): Viewport => ({ t0, pxPerYear, width });
const noCategories = new Map<string, Category>();

let counter = 0;
function rangeEvent(
  name: string,
  fromBc: number,
  toBc: number,
  extra: Partial<TimelineEvent> = {},
): TimelineEvent {
  return {
    id: `e${counter++}`,
    name,
    type: 'range',
    categoryId: null,
    start: { year: toAstronomicalYear(fromBc, 'bc'), month: null, day: null, approx: false, qualifier: null },
    end: { year: toAstronomicalYear(toBc, 'bc'), month: null, day: null, approx: false, qualifier: null },
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
  return { ...rangeEvent(name, yearBc, yearBc, extra), type: 'point', end: null, ...extra };
}

const layout = (events: TimelineEvent[], v: Viewport) =>
  layoutEvents(events, v, noCategories, measure, roky);

describe('rozsah záznamu na ose', () => {
  it('rozsah pokrývá celé krajní roky', () => {
    const { from, to } = eventExtent(rangeEvent('Metuzalém', 3339, 2370));
    expect(to - from).toBeCloseTo(970, 6);
  });

  it('bod je jediný okamžik', () => {
    const { from, to } = eventExtent(pointEvent('Potopa', 2370));
    expect(from).toBe(to);
  });
});

describe('pásma kolem centrální čáry', () => {
  it('bodové události jsou nad čárou, rozsahy pod ní', () => {
    const result = layout([pointEvent('Potopa', 2370), rangeEvent('Noe', 2970, 2020)], view(-3000, 0.5));
    const bod = result.items.find((i) => i.isPoint)!;
    const rozsah = result.items.find((i) => !i.isPoint)!;
    expect(bod.band).toBe('point');
    expect(rozsah.band).toBe('range');
    expect(pointLaneY(bod.lane)).toBeLessThan(0);
    expect(rangeLaneY(rozsah.lane)).toBeGreaterThan(0);
  });

  it('každé pásmo se řádkuje samostatně', () => {
    const result = layout(
      [pointEvent('A', 2370), rangeEvent('B', 2970, 2020), rangeEvent('C', 2900, 2100)],
      view(-3000, 0.5),
    );
    expect(result.items.find((i) => i.event.name === 'A')!.lane).toBe(0);
    const rozsahy = result.items.filter((i) => !i.isPoint).map((i) => i.lane).sort();
    expect(rozsahy).toEqual([0, 1]);
  });

  it('výška pásem roste s počtem řádků', () => {
    const jeden = layout([rangeEvent('A', 2970, 2020)], view(-3000, 0.5));
    const dva = layout([rangeEvent('A', 2970, 2020), rangeEvent('B', 2900, 2100)], view(-3000, 0.5));
    expect(dva.heightBelow).toBeGreaterThan(jeden.heightBelow);
    expect(jeden.heightAbove).toBe(0);
  });

  it('pilulky nad limit se schovají a spadnou zpátky na čáru', () => {
    // 20 událostí těsně vedle sebe: pilulky se do povoleného počtu řádků nevejdou
    const events = Array.from({ length: 20 }, (_, i) => pointEvent(`Událost číslo ${i}`, 2000 - i));
    const result = layout(events, view(-2100, 0.5));
    expect(result.pointLaneCount).toBeLessThanOrEqual(MAX_POINT_LANES);
    const skryte = result.items.filter((i) => i.labelMode === 'none');
    expect(skryte.length).toBeGreaterThan(0);
    for (const item of skryte) expect(item.lane).toBe(0);
  });
});

describe('popisky rozsahů', () => {
  it('do širokého pruhu se vejde jméno i roky', () => {
    const result = layout([rangeEvent('Noe', 2970, 2020)], view(-3000, 1));
    expect(result.items[0].labelMode).toBe('inside-full');
  });

  it('užší pruh ztratí roky, pak i jméno', () => {
    // „Metuzalém" má při použitém měření 77 px, roky 25 px
    const siroky = layout([rangeEvent('Metuzalém', 3339, 3139)], view(-3400, 1)).items[0];
    expect(siroky.labelMode).toBe('inside-full');
    const stredni = layout([rangeEvent('Metuzalém', 3339, 3219)], view(-3400, 1)).items[0];
    expect(stredni.labelMode).toBe('inside-name');
    const uzky = layout([rangeEvent('Metuzalém', 3339, 3319)], view(-3400, 1)).items[0];
    expect(uzky.labelMode).toBe('outside-full');
  });

  it('přibližná hranice popisek neposouvá – kraj je otevřený, ne rozplynutý', () => {
    const v = view(-3000, 1);
    const jisty = layout([rangeEvent('Noe', 2970, 2020)], v).items[0];
    const priblizny = layout(
      [
        rangeEvent('Noe', 2970, 2020, {
          start: { year: toAstronomicalYear(2970, 'bc'), month: null, day: null, approx: true, qualifier: null },
        }),
      ],
      v,
    ).items[0];
    expect(jisty.labelX).toBeCloseTo(jisty.x1 + BAR_LABEL_INSET, 6);
    expect(priblizny.labelX).toBeCloseTo(jisty.labelX, 6);
    expect(priblizny.labelMode).toBe(jisty.labelMode);
  });

  it('u pruhu delšího než výřez zůstane popisek u okraje plátna', () => {
    const result = layout([rangeEvent('Metuzalém', 3339, 2370)], view(-2900, 50));
    const item = result.items[0];
    expect(item.x1).toBeLessThan(0);
    expect(item.labelX).toBe(BAR_LABEL_INSET);
  });
});

describe('otevřené hranice', () => {
  it('„min." otevírá doprava, „před rokem" doleva', () => {
    const doprava = pointEvent('Asýrie', 874, {
      start: { year: toAstronomicalYear(874, 'bc'), month: null, day: null, approx: false, qualifier: 'after' },
    });
    const doleva = pointEvent('Smrt Abela', 3896, {
      start: { year: toAstronomicalYear(3896, 'bc'), month: null, day: null, approx: false, qualifier: 'before' },
    });
    const result = layout([doprava, doleva], view(-4000, 0.5));
    expect(result.items.find((i) => i.event.name === 'Asýrie')!.startOpen).toBe('right');
    expect(result.items.find((i) => i.event.name === 'Smrt Abela')!.startOpen).toBe('left');
  });

  it('uzavřená hranice nemá směr', () => {
    expect(layout([pointEvent('Potopa', 2370)], view(-2400, 1)).items[0].startOpen).toBeNull();
  });
});

describe('barvy', () => {
  it('bere barvu z kategorie', () => {
    const categories = new Map<string, Category>([
      ['c1', { id: 'c1', name: 'Do potopy', color: '#b16c4c', sortOrder: 0, fromYear: -4200, toYear: -2369 }],
    ]);
    const result = layoutEvents(
      [pointEvent('Potopa', 2370, { categoryId: 'c1' }), pointEvent('Jiné', 2000)],
      view(-2400, 1),
      categories,
      measure,
      roky,
    );
    expect(result.items[0].color).toBe('#b16c4c');
    expect(result.items[1].color).toBe(NO_CATEGORY_COLOR);
  });
});

describe('zásah kliknutím', () => {
  it('trefí pruh podle vzdálenosti od čáry', () => {
    const result = layout([rangeEvent('Noe', 2970, 2020)], view(-3000, 1));
    const item = result.items[0];
    expect(hitTest(result, item.centerX, rangeLaneY(item.lane))?.event.id).toBe(item.event.id);
    // nad čárou v tom místě nic není
    expect(hitTest(result, item.centerX, pointLaneY(0))).toBeNull();
  });

  it('trefí pilulku nad čárou', () => {
    const result = layout([pointEvent('Potopa', 2370)], view(-2400, 1));
    const item = result.items[0];
    expect(hitTest(result, item.centerX, pointLaneY(item.lane))?.event.id).toBe(item.event.id);
  });

  it('mimo záznam vrací null', () => {
    const result = layout([rangeEvent('Noe', 2970, 2020)], view(-3000, 1));
    expect(hitTest(result, 990, rangeLaneY(0))).toBeNull();
  });
});
