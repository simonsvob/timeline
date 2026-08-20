import { describe, expect, it } from 'vitest';
import { buildExport, parseImport, serializeExport, exportFileName } from './transfer';
import { EXPORT_SCHEMA_VERSION, type Dataset } from './types';

const dataset: Dataset = {
  categories: [
    {
      id: 'c1',
      name: 'Období patriarchů',
      color: '#898335',
      sortOrder: 0,
      fromYear: -2369,
      toYear: -1472,
    },
  ],
  tags: [{ id: 't1', name: 'událost', color: '#b1734c', sortOrder: 0 }],
  events: [
    {
      id: 'e1',
      name: 'Potopa',
      type: 'point',
      placement: 'udalosti',
      tagId: 't1',
      start: { year: -2369, month: null, day: null, approx: false, qualifier: null },
      end: null,
      source: '1. Mojžíšova 7,11',
      note: null,
      placeName: null,
      lat: null,
      lng: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'e2',
      name: 'Metuzalém',
      type: 'range',
      placement: 'zivoty',
      tagId: 't1',
      start: { year: -3338, month: null, day: null, approx: true, qualifier: null },
      end: { year: -2369, month: 10, day: 7, approx: false, qualifier: null },
      source: null,
      note: 'Nejdelší život',
      placeName: null,
      lat: null,
      lng: null,
      createdAt: '',
      updatedAt: '',
    },
  ],
};

describe('export', () => {
  it('má verzi schématu a obě kolekce', () => {
    const file = buildExport(dataset);
    expect(file.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(file.categories).toHaveLength(1);
    expect(file.tags).toHaveLength(1);
    expect(file.events).toHaveLength(2);
    expect(file.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('název souboru obsahuje datum', () => {
    expect(exportFileName(new Date('2025-03-04T10:00:00Z'))).toContain('2025-03-04');
    expect(exportFileName()).toMatch(/\.json$/);
  });
});

describe('import', () => {
  it('projde tam a zpět beze ztráty', () => {
    const result = parseImport(serializeExport(dataset));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.categories).toEqual(dataset.categories);
    expect(result.dataset.events).toEqual(dataset.events);
  });

  it('zachová přesnost i jistotu', () => {
    const result = parseImport(serializeExport(dataset));
    if (!result.ok) throw new Error('nemělo selhat');
    const potopa = result.dataset.events.find((e) => e.id === 'e1')!;
    expect(potopa.start.month).toBeNull();
    expect(potopa.start.day).toBeNull();
    const metuzalem = result.dataset.events.find((e) => e.id === 'e2')!;
    expect(metuzalem.start.approx).toBe(true);
    expect(metuzalem.end).toEqual({ year: -2369, month: 10, day: 7, approx: false, qualifier: null });
  });

  it('odmítne nevalidní JSON', () => {
    const result = parseImport('{ tohle není json');
    expect(result.ok).toBe(false);
  });

  it('odmítne cizí strukturu', () => {
    expect(parseImport('{"foo":1}').ok).toBe(false);
    expect(parseImport('[]').ok).toBe(false);
  });

  it('načte i starší verzi schématu bez kvalifikátoru', () => {
    const stary = {
      schemaVersion: 1,
      exportedAt: '',
      categories: [],
      events: [{ name: 'Petr', type: 'point', start: { year: -4, approx: true } }],
    };
    const result = parseImport(JSON.stringify(stary));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.schemaVersion).toBe(1);
    expect(result.dataset.events[0].start.qualifier).toBeNull();
    expect(result.dataset.events[0].start.approx).toBe(true);
  });

  it('zachová otevřenou hranici', () => {
    const result = parseImport(
      JSON.stringify({
        schemaVersion: 2,
        exportedAt: '',
        categories: [],
        events: [
          {
            name: 'Petr',
            type: 'range',
            start: { year: -4, approx: true },
            end: { year: 64, qualifier: 'min' },
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.events[0].end?.qualifier).toBe('min');
  });

  it('neznámý kvalifikátor zahodí', () => {
    const result = parseImport(
      JSON.stringify({
        schemaVersion: 2,
        exportedAt: '',
        categories: [],
        events: [{ name: 'X', type: 'point', start: { year: 1, qualifier: 'nesmysl' } }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dataset.events[0].start.qualifier).toBeNull();
  });

  it('odmítne neznámou verzi schématu', () => {
    const file = { ...buildExport(dataset), schemaVersion: 99 };
    const result = parseImport(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('99');
  });

  it('odmítne záznam s neplatným datem', () => {
    const broken = {
      ...buildExport(dataset),
      events: [{ ...dataset.events[0], start: { year: -2369, month: 2, day: 30, approx: false, qualifier: null } }],
    };
    expect(parseImport(JSON.stringify(broken)).ok).toBe(false);
  });

  it('odmítne rozsah bez konce', () => {
    const broken = { ...buildExport(dataset), events: [{ ...dataset.events[1], end: null }] };
    expect(parseImport(JSON.stringify(broken)).ok).toBe(false);
  });

  it('odmítne den bez měsíce', () => {
    const broken = {
      ...buildExport(dataset),
      events: [{ ...dataset.events[0], start: { year: -2369, month: null, day: 7, approx: false, qualifier: null } }],
    };
    expect(parseImport(JSON.stringify(broken)).ok).toBe(false);
  });

  it('kategorie bez rozsahu období se načte s prázdnými roky', () => {
    const result = parseImport(
      JSON.stringify({
        schemaVersion: 2,
        exportedAt: '',
        categories: [{ id: 'x', name: 'Štítek', color: '#000000', sortOrder: 0 }],
        events: [],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.categories[0].fromYear).toBeNull();
    expect(result.dataset.categories[0].toYear).toBeNull();
  });

  it('zachová rozsah období', () => {
    const result = parseImport(serializeExport(dataset));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.categories[0].fromYear).toBe(-2369);
    expect(result.dataset.categories[0].toYear).toBe(-1472);
  });

  it('doplní chybějící id', () => {
    const file = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: '',
      categories: [{ name: 'Králové', color: '#3a6b8c' }],
      events: [{ name: 'Šalomoun', type: 'point', start: { year: -1036 } }],
    };
    const result = parseImport(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.categories[0].id).toBeTruthy();
    expect(result.dataset.events[0].id).toBeTruthy();
    expect(result.dataset.events[0].start.approx).toBe(false);
  });

  it('zahodí odkaz na neexistující štítek', () => {
    const file = {
      ...buildExport(dataset),
      tags: [],
    };
    const result = parseImport(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.events.every((e) => e.tagId === null)).toBe(true);
  });

  it('starší export bez umístění ho odvodí z klíčových slov', () => {
    const result = parseImport(
      JSON.stringify({
        schemaVersion: 3,
        exportedAt: '',
        categories: [],
        events: [
          { name: 'Egypt', type: 'range', start: { year: -1600 }, end: { year: -874 }, tags: ['velmoc'] },
          { name: 'Asa', type: 'range', start: { year: -976 }, end: { year: -936 }, tags: ['vlada-juda', 'kral'] },
          { name: 'Noe', type: 'range', start: { year: -2970 }, end: { year: -2020 }, tags: ['zivot'] },
          { name: 'Něco', type: 'point', start: { year: -800 }, tags: ['neznamy'] },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Neznámé klíčové slovo končí u rozsahů pod osou (DEFAULT_PLACEMENT).
    expect(result.dataset.events.map((e) => e.placement)).toEqual([
      'velmoci',
      'juda',
      'zivoty',
      'zivoty',
    ]);
    // Klíčová slova sama do aplikace nejdou – zbyla jen jako vodítko pro umístění.
    expect('keywords' in result.dataset.events[1]).toBe(false);
  });
});
