import { describe, expect, it } from 'vitest';
import {
  BAND_GAP,
  BAR_LABEL_INSET,
  bandOf,
  eventExtent,
  hitTest,
  itemY,
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

/** Rozsah zadaný astronomickými roky (kladné = n. l.). */
function adRange(name: string, from: number, to: number): TimelineEvent {
  const bod = (year: number) => ({ year, month: null, day: null, approx: false, qualifier: null });
  return { ...rangeEvent(name, 1, 1), start: bod(from), end: bod(to) };
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

/** Rám plochy: plátno 900 px vysoké, čára uprostřed. */
const frame = (result: ReturnType<typeof layout>) => ({
  axisY: 450,
  top: result.pinnedTop,
  bottom: 900 - result.pinnedBottom,
});

/** Svislá poloha záznamu v pixelech plátna. */
const yOf = (result: ReturnType<typeof layout>, name: string) =>
  itemY(named(result, name), frame(result));

describe('rozsah záznamu na ose', () => {
  it('rozsah končí na začátku koncového roku, ne na jeho konci', () => {
    const { from, to } = eventExtent(rangeEvent('Metuzalém', 3339, 2370));
    // stejná délka, jakou hlásí `rangeLengthYears`
    expect(to - from).toBeCloseTo(969, 6);
    expect(to).toBe(toAstronomicalYear(2370, 'bc'));
  });

  it('navazující vlády se nepřekrývají', () => {
    const prvni = eventExtent(reignEvent('Rechoboam', 997, 980));
    const druha = eventExtent(reignEvent('Abijam', 980, 978));
    expect(prvni.to).toBe(druha.from);
  });

  it('bod leží na začátku svého roku, ne uprostřed', () => {
    const { from, to } = eventExtent(pointEvent('Potopa', 2370));
    expect(from).toBe(to);
    expect(from).toBe(toAstronomicalYear(2370, 'bc'));
  });
});

describe('stabilita při vodorovném posunu', () => {
  /**
   * Řádkuje se v souřadnicích odvozených z let, ne z pixelů na plátně —
   * jinak posun mění zaokrouhlení a položky se stejným začátkem si přehazují
   * řádky (projevovalo se problikáváním u apoštolů kolem přelomu letopočtu).
   */
  const soubezne = [
    adRange('Marie Magdaléna', -4, 33),
    adRange('Štěpán', -4, 33),
    adRange('Petr', -4, 64),
    adRange('Barnabáš', -4, 55),
    adRange('apoštol Jan', -4, 100),
    adRange('Ježíš', -1, 33),
    adRange('Jan Křtitel', -1, 32),
  ];

  for (const [popis, pxPerYear, t0] of [
    ['při velkém oddálení', 0.34, -4200],
    ['přiblíženo na přelom letopočtu', 6, -60],
  ] as const) {
    it(`${popis} nezmění ani jeden řádek`, () => {
      let predchozi: string | null = null;
      for (let i = 0; i < 60; i++) {
        const result = layout(soubezne, view(t0 + i * (1 / pxPerYear), pxPerYear, 1500));
        const otisk = result.items.map((x) => `${x.name}:${x.lane}`).sort().join('|');
        if (predchozi !== null) expect(otisk).toBe(predchozi);
        predchozi = otisk;
      }
    });
  }

  it('pořadí kreslení se posunem nemění', () => {
    let predchozi: string | null = null;
    for (let i = 0; i < 60; i++) {
      const result = layout(soubezne, view(-60 + i / 6, 6, 1500));
      const poradi = result.items.map((x) => x.name).join('|');
      if (predchozi !== null) expect(poradi).toBe(predchozi);
      predchozi = poradi;
    }
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

  it('shora dolů: velmoci, události, čára, životy, Izrael, Juda', () => {
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
    const poradi = ['Egypt', 'Potopa', 'Noe', 'Omri', 'Asa'].map((n) => yOf(result, n));
    for (let i = 1; i < poradi.length; i++) expect(poradi[i]).toBeGreaterThan(poradi[i - 1]);
    expect(yOf(result, 'Noe')).toBeGreaterThan(frame(result).axisY);
    expect(yOf(result, 'Potopa')).toBeLessThan(frame(result).axisY);
  });

  it('připnutá pásma se svislým posunem osy nehýbou', () => {
    const events = [
      rangeEvent('Egypt', 1600, 874, { tags: ['velmoc'] }),
      rangeEvent('Noe', 2970, 2020),
      reignEvent('Asa', 977, 937),
    ];
    const result = layout(events, view(-3000, 0.3));
    const posunuty = { ...frame(result), axisY: 300 };
    expect(itemY(named(result, 'Egypt'), posunuty)).toBe(yOf(result, 'Egypt'));
    expect(itemY(named(result, 'Asa'), posunuty)).toBe(yOf(result, 'Asa'));
    expect(itemY(named(result, 'Noe'), posunuty)).not.toBe(yOf(result, 'Noe'));
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
    expect(bezVlad.pinnedBottom).toBe(0);
    expect(sVladami.pinnedBottom).toBeGreaterThan(0);
  });

  it('skryté pásmo zmizí i s místem, které zabíralo', () => {
    const events = [rangeEvent('Noe', 2970, 2020), reignEvent('Asa', 977, 937)];
    const vse = layout(events, view(-3000, 0.5));
    const bezVlad = layout(events, view(-3000, 0.5), new Set(['juda']));
    expect(bezVlad.items.some((i) => i.bandId === 'juda')).toBe(false);
    expect(bezVlad.bands.map((b) => b.id)).toEqual(['zivoty']);
    expect(vse.pinnedBottom).toBeGreaterThan(0);
    expect(bezVlad.pinnedBottom).toBe(0);
  });

  it('mezi plovoucími pásmy je mezera', () => {
    const result = layout(
      [rangeEvent('Noe', 2970, 2020), pointEvent('Něco', 2000, { tags: ['neznamy'] })],
      view(-3000, 0.5),
    );
    const zivoty = result.bands.find((b) => b.id === 'zivoty')!;
    const ostatni = result.bands.find((b) => b.id === 'ostatni')!;
    expect(ostatni.near).toBe(zivoty.near + zivoty.extent + BAND_GAP);
  });

  it('Juda je úplně dole, Izrael nad ní', () => {
    const result = layout(
      [reignEvent('Asa', 977, 937), reignEvent('Omri', 940, 930, 'vlada-izrael')],
      view(-1000, 1),
    );
    const juda = result.bands.find((b) => b.id === 'juda')!;
    const izrael = result.bands.find((b) => b.id === 'izrael')!;
    // `near` je vzdálenost od dolní hrany, takže Juda má menší
    expect(juda.near).toBeLessThan(izrael.near);
    expect(yOf(result, 'Asa')).toBeGreaterThan(yOf(result, 'Omri'));
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
  it('trefí pruh pod čárou', () => {
    const result = layout([rangeEvent('Noe', 2970, 2020)], view(-3000, 1));
    const item = result.items[0];
    const f = frame(result);
    expect(hitTest(result, item.centerX, itemY(item, f), f)?.event.id).toBe(item.event.id);
    // nad čárou v tom místě nic není
    expect(hitTest(result, item.centerX, f.axisY - 90, f)).toBeNull();
  });

  it('trefí pilulku nad čárou', () => {
    const result = layout([pointEvent('Potopa', 2370)], view(-2400, 1));
    const item = result.items[0];
    const f = frame(result);
    expect(hitTest(result, item.centerX, itemY(item, f), f)?.event.id).toBe(item.event.id);
  });

  it('rozliší dvě připnutá pásma pod sebou', () => {
    const result = layout(
      [reignEvent('Asa', 977, 937), reignEvent('Omri', 940, 930, 'vlada-izrael')],
      view(-1000, 1),
    );
    const f = frame(result);
    const omri = named(result, 'Omri');
    expect(hitTest(result, omri.centerX, yOf(result, 'Asa'), f)?.event.name).toBe('Asa');
    expect(hitTest(result, omri.centerX, yOf(result, 'Omri'), f)?.event.name).toBe('Omri');
  });

  it('mimo záznam vrací null', () => {
    const result = layout([rangeEvent('Noe', 2970, 2020)], view(-3000, 1));
    const f = frame(result);
    expect(hitTest(result, 990, itemY(result.items[0], f), f)).toBeNull();
  });
});
