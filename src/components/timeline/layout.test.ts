import { describe, expect, it } from 'vitest';
import {
  BAND_GAP,
  BAR_LABEL_INSET,
  bandOf,
  eventExtent,
  hitTest,
  layoutEvents,
  MAX_POINT_LANES,
  NO_CATEGORY_COLOR,
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
    tags: ['zivot'],
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

function pointEvent(name: string, yearBc: number, extra: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    ...rangeEvent(name, yearBc, yearBc, extra),
    type: 'point',
    end: null,
    tags: ['udalost'],
    ...extra,
  };
}

/** Vláda v pásmu na jedné řadě. */
function reignEvent(
  name: string,
  fromBc: number,
  toBc: number,
  bandTag = 'vlada-juda',
): TimelineEvent {
  return rangeEvent(name, fromBc, toBc, { tags: [bandTag, 'kral'] });
}

const layout = (events: TimelineEvent[], v: Viewport, hidden?: Set<string>) =>
  layoutEvents(events, v, noCategories, measure, roky, hidden);

const named = (result: ReturnType<typeof layout>, name: string) =>
  result.items.find((i) => i.event.name === name)!;

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

describe('zařazení do pásem', () => {
  it('štítek rozhoduje, kam záznam patří', () => {
    expect(bandOf(pointEvent('Potopa', 2370)).id).toBe('udalosti');
    expect(bandOf(rangeEvent('Noe', 2970, 2020)).id).toBe('zivoty');
    expect(bandOf(reignEvent('Asa', 977, 937)).id).toBe('juda');
    expect(bandOf(reignEvent('Omri', 940, 930, 'vlada-izrael')).id).toBe('izrael');
    expect(bandOf(rangeEvent('Egypt', 1600, 874, { tags: ['velmoc'] })).id).toBe('velmoci');
  });

  it('kniha patří k událostem, neznámý štítek do ostatních', () => {
    expect(bandOf(pointEvent('Kniha Amos', 803, { tags: ['kniha'] })).id).toBe('udalosti');
    expect(bandOf(pointEvent('Něco', 800, { tags: ['neznamy'] })).id).toBe('ostatni');
    expect(bandOf(pointEvent('Bez štítku', 800, { tags: [] })).id).toBe('ostatni');
  });

  it('12 kmenů sdílí řadu s Judou a nepřekrývá se s ní', () => {
    const result = layout(
      [reignEvent('Saul', 1117, 1077, 'vlada-12kmenu'), reignEvent('Rechoboam', 997, 980)],
      view(-1200, 1),
    );
    const saul = named(result, 'Saul');
    const rechoboam = named(result, 'Rechoboam');
    expect(saul.bandId).toBe('juda');
    expect(saul.centerY).toBe(rechoboam.centerY);
  });
});

describe('svislé skládání pásem', () => {
  it('události leží nad čárou, životy pod ní', () => {
    const result = layout([pointEvent('Potopa', 2370), rangeEvent('Noe', 2970, 2020)], view(-3000, 0.5));
    expect(named(result, 'Potopa').centerY).toBeLessThan(0);
    expect(named(result, 'Noe').centerY).toBeGreaterThan(0);
  });

  it('velmoci jsou nad událostmi, vlády pod životy', () => {
    const result = layout(
      [
        rangeEvent('Egypt', 1600, 874, { tags: ['velmoc'] }),
        pointEvent('Potopa', 2370),
        rangeEvent('Noe', 2970, 2020),
        reignEvent('Asa', 977, 937),
        reignEvent('Omri', 940, 930, 'vlada-izrael'),
      ],
      view(-3000, 0.3),
    );
    // nad čárou: čím výš, tím zápornější
    expect(named(result, 'Egypt').centerY).toBeLessThan(named(result, 'Potopa').centerY);
    // pod čárou: čím níž, tím větší
    expect(named(result, 'Noe').centerY).toBeLessThan(named(result, 'Asa').centerY);
    expect(named(result, 'Asa').centerY).toBeLessThan(named(result, 'Omri').centerY);
  });

  it('každé pásmo se řádkuje samostatně', () => {
    const result = layout(
      [pointEvent('A', 2370), rangeEvent('B', 2970, 2020), rangeEvent('C', 2900, 2100)],
      view(-3000, 0.5),
    );
    expect(named(result, 'A').lane).toBe(0);
    const zivoty = result.items.filter((i) => i.bandId === 'zivoty').map((i) => i.lane).sort();
    expect(zivoty).toEqual([0, 1]);
  });

  it('prázdné pásmo nezabírá svislé místo', () => {
    const bezVlad = layout([rangeEvent('Noe', 2970, 2020)], view(-3000, 0.5));
    const sVladami = layout(
      [rangeEvent('Noe', 2970, 2020), reignEvent('Asa', 977, 937)],
      view(-3000, 0.5),
    );
    expect(bezVlad.bands.map((b) => b.id)).toEqual(['zivoty']);
    expect(sVladami.heightBelow).toBeGreaterThan(bezVlad.heightBelow);
  });

  it('skryté pásmo zmizí i s místem, které zabíralo', () => {
    const events = [rangeEvent('Noe', 2970, 2020), reignEvent('Asa', 977, 937)];
    const vse = layout(events, view(-3000, 0.5));
    const bezVlad = layout(events, view(-3000, 0.5), new Set(['juda']));
    expect(bezVlad.items.some((i) => i.bandId === 'juda')).toBe(false);
    expect(bezVlad.bands.map((b) => b.id)).toEqual(['zivoty']);
    expect(bezVlad.heightBelow).toBeLessThan(vse.heightBelow);
  });

  it('mezi pásmy je mezera', () => {
    const result = layout(
      [reignEvent('Asa', 977, 937), reignEvent('Omri', 940, 930, 'vlada-izrael')],
      view(-1000, 1),
    );
    const juda = result.bands.find((b) => b.id === 'juda')!;
    const izrael = result.bands.find((b) => b.id === 'izrael')!;
    expect(izrael.near).toBe(juda.near + juda.extent + BAND_GAP);
  });

  it('výška pásma roste s počtem řádků', () => {
    const jeden = layout([rangeEvent('A', 2970, 2020)], view(-3000, 0.5));
    const dva = layout([rangeEvent('A', 2970, 2020), rangeEvent('B', 2900, 2100)], view(-3000, 0.5));
    expect(dva.heightBelow).toBeGreaterThan(jeden.heightBelow);
    expect(jeden.heightAbove).toBe(0);
  });

  it('pilulky nad limit se schovají a spadnou zpátky na čáru', () => {
    // 20 událostí těsně vedle sebe: pilulky se do povoleného počtu řádků nevejdou
    const events = Array.from({ length: 20 }, (_, i) => pointEvent(`Událost číslo ${i}`, 2000 - i));
    const result = layout(events, view(-2100, 0.5));
    const udalosti = result.bands.find((b) => b.id === 'udalosti')!;
    expect(udalosti.laneCount).toBeLessThanOrEqual(MAX_POINT_LANES);
    const skryte = result.items.filter((i) => i.labelMode === 'none');
    expect(skryte.length).toBeGreaterThan(0);
    for (const item of skryte) expect(item.lane).toBe(0);
  });
});

describe('pásmo na jedné řadě', () => {
  it('navazující vlády zůstanou na jedné řadě', () => {
    const vlady = [
      reignEvent('Rechoboam', 997, 980),
      reignEvent('Abijam', 980, 978),
      reignEvent('Asa', 978, 937),
      reignEvent('Jehošafat', 937, 913),
    ];
    const result = layout(vlady, view(-1050, 1));
    const lanes = new Set(result.items.map((i) => i.lane));
    expect(lanes).toEqual(new Set([0]));
    expect(result.bands.find((b) => b.id === 'juda')!.laneCount).toBe(1);
  });

  it('sousedé se odliší střídavým odstínem', () => {
    const result = layout(
      [
        reignEvent('Rechoboam', 997, 980),
        reignEvent('Abijam', 980, 978),
        reignEvent('Asa', 978, 937),
      ],
      view(-1050, 1),
    );
    expect(named(result, 'Rechoboam').shade).toBe(0);
    expect(named(result, 'Abijam').shade).toBe(1);
    expect(named(result, 'Asa').shade).toBe(0);
  });

  it('popisek se vedle pruhu nikdy nevykreslí – jen dovnitř, nebo vůbec', () => {
    const result = layout(
      [reignEvent('Rechoboam', 997, 980), reignEvent('Abijam', 980, 978)],
      view(-1050, 1),
    );
    for (const item of result.items) {
      expect(['inside-full', 'inside-name', 'none']).toContain(item.labelMode);
    }
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
    expect(named(result, 'Asýrie').startOpen).toBe('right');
    expect(named(result, 'Smrt Abela').startOpen).toBe('left');
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
    expect(named(result, 'Potopa').color).toBe('#b16c4c');
    expect(named(result, 'Jiné').color).toBe(NO_CATEGORY_COLOR);
  });
});

describe('zásah kliknutím', () => {
  it('trefí pruh podle vzdálenosti od čáry', () => {
    const result = layout([rangeEvent('Noe', 2970, 2020)], view(-3000, 1));
    const item = result.items[0];
    expect(hitTest(result, item.centerX, item.centerY)?.event.id).toBe(item.event.id);
    // nad čárou v tom místě nic není
    expect(hitTest(result, item.centerX, -90)).toBeNull();
  });

  it('trefí pilulku nad čárou', () => {
    const result = layout([pointEvent('Potopa', 2370)], view(-2400, 1));
    const item = result.items[0];
    expect(hitTest(result, item.centerX, item.centerY)?.event.id).toBe(item.event.id);
  });

  it('rozliší dvě pásma pod sebou', () => {
    const result = layout(
      [reignEvent('Asa', 977, 937), reignEvent('Omri', 940, 930, 'vlada-izrael')],
      view(-1000, 1),
    );
    const asa = named(result, 'Asa');
    const omri = named(result, 'Omri');
    expect(hitTest(result, omri.centerX, asa.centerY)?.event.name).toBe('Asa');
    expect(hitTest(result, omri.centerX, omri.centerY)?.event.name).toBe('Omri');
  });

  it('mimo záznam vrací null', () => {
    const result = layout([rangeEvent('Noe', 2970, 2020)], view(-3000, 1));
    expect(hitTest(result, 990, result.items[0].centerY)).toBeNull();
  });
});
