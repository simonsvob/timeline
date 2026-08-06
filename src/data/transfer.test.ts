import { describe, expect, it } from 'vitest';
import { buildExport, parseImport, serializeExport, exportFileName } from './transfer';
import { EXPORT_SCHEMA_VERSION, type Dataset } from './types';

const dataset: Dataset = {
  categories: [{ id: 'c1', name: 'Patriarchové', color: '#a2563c', sortOrder: 0 }],
  events: [
    {
      id: 'e1',
      name: 'Potopa',
      type: 'point',
      categoryId: 'c1',
      start: { year: -2369, month: null, day: null, approx: false },
      end: null,
      source: '1. Mojžíšova 7,11',
      note: null,
      placeName: null,
      lat: null,
      lng: null,
      tags: ['potopa'],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'e2',
      name: 'Metuzalém',
      type: 'range',
      categoryId: 'c1',
      start: { year: -3338, month: null, day: null, approx: true },
      end: { year: -2369, month: 10, day: 7, approx: false },
      source: null,
      note: 'Nejdelší život',
      placeName: null,
      lat: null,
      lng: null,
      tags: [],
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
    expect(metuzalem.end).toEqual({ year: -2369, month: 10, day: 7, approx: false });
  });

  it('odmítne nevalidní JSON', () => {
    const result = parseImport('{ tohle není json');
    expect(result.ok).toBe(false);
  });

  it('odmítne cizí strukturu', () => {
    expect(parseImport('{"foo":1}').ok).toBe(false);
    expect(parseImport('[]').ok).toBe(false);
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
      events: [{ ...dataset.events[0], start: { year: -2369, month: 2, day: 30, approx: false } }],
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
      events: [{ ...dataset.events[0], start: { year: -2369, month: null, day: 7, approx: false } }],
    };
    expect(parseImport(JSON.stringify(broken)).ok).toBe(false);
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

  it('zahodí odkaz na neexistující kategorii', () => {
    const file = {
      ...buildExport(dataset),
      categories: [],
    };
    const result = parseImport(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.events.every((e) => e.categoryId === null)).toBe(true);
  });
});
