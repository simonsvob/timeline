import { describe, expect, it } from 'vitest';
import type { Person, Relation } from '../data/types';
import {
  NODE_GAP_X,
  NODE_WIDTH,
  buildKinIndex,
  expansionsToReveal,
  layoutTree,
  primaryParentRelation,
  relativesOf,
  treeRoots,
} from './genealogy';

function person(id: string, extra: Partial<Person> = {}): Person {
  return { id, name: id, qualifier: null, altNames: [], gender: 'm', roles: [], spine: false, note: null, ...extra };
}

let serial = 0;
function parent(from: string, to: string, extra: Partial<Relation> = {}): Relation {
  serial += 1;
  return {
    id: `r${String(serial).padStart(3, '0')}`,
    kind: 'rodic',
    fromPerson: from,
    toPerson: to,
    certainty: 'vyslovne',
    source: null,
    note: null,
    verified: true,
    sortOrder: 0,
    ...extra,
  };
}

/** Adam → (Kain, Ábel, Set) → Enoš; páteř Adam–Set–Enoš, matka Eva. */
const persons = [
  person('adam', { spine: true }),
  person('eva', { gender: 'f' }),
  person('kain'),
  person('abel'),
  person('set', { spine: true }),
  person('enos', { spine: true }),
  person('enoch-kainuv'),
  person('irad'),
];
const relations = [
  parent('adam', 'kain', { sortOrder: 1 }),
  parent('eva', 'kain', { sortOrder: 1 }),
  parent('adam', 'abel', { sortOrder: 2 }),
  parent('adam', 'set', { sortOrder: 3 }),
  parent('eva', 'set', { sortOrder: 3 }),
  parent('set', 'enos'),
  parent('kain', 'enoch-kainuv'),
  parent('enoch-kainuv', 'irad'),
  { ...parent('adam', 'eva'), kind: 'manzelstvi' as const },
];
const index = buildKinIndex(persons, relations, { includeUnverified: true });
const xOf = (layout: ReturnType<typeof layoutTree>, id: string) => layout.nodes.find((n) => n.id === id)?.x;

describe('hlavní rodič', () => {
  it('dítě visí pod otcem, matka se ukáže jen v detailu', () => {
    expect(primaryParentRelation(index, 'kain')?.fromPerson).toBe('adam');
  });

  it('osoba na páteři patří pod rodiče na páteři, i když pramen uvádí jiného otce', () => {
    const lide = [person('jehojakin', { spine: true }), person('neri'), person('sealtiel', { spine: true })];
    const vazby = [parent('neri', 'sealtiel'), parent('jehojakin', 'sealtiel')];
    const i = buildKinIndex(lide, vazby, { includeUnverified: true });
    expect(primaryParentRelation(i, 'sealtiel')?.fromPerson).toBe('jehojakin');
  });

  it('kořen je osoba bez rodiče, pod kterou někdo visí – Eva jím není', () => {
    expect(treeRoots(index)).toEqual(['adam']);
  });
});

describe('rozvržení stromu', () => {
  it('na začátku je vidět jen páteř a počet schovaných dětí', () => {
    const layout = layoutTree(index, new Set());
    expect(layout.nodes.map((n) => n.id)).toEqual(['adam', 'set', 'enos']);
    const adam = layout.nodes[0];
    expect(adam.hidden).toBe(2);
    expect(adam.foldable).toBe(true);
  });

  it('páteř drží svislou přímku i s rozbalenými větvemi', () => {
    const layout = layoutTree(index, new Set(['adam']));
    expect(xOf(layout, 'adam')).toBe(xOf(layout, 'set'));
    expect(xOf(layout, 'set')).toBe(xOf(layout, 'enos'));
  });

  it('děti stojí v uloženém pořadí, ne podle abecedy', () => {
    const layout = layoutTree(index, new Set(['adam']));
    expect(xOf(layout, 'kain')!).toBeLessThan(xOf(layout, 'abel')!);
    expect(xOf(layout, 'abel')!).toBeLessThan(xOf(layout, 'set')!);
  });

  it('řada jedináčků mimo páteř teče dál bez klepání', () => {
    const layout = layoutTree(index, new Set(['adam']));
    expect(layout.nodes.map((n) => n.id)).toContain('irad');
  });

  it('karty ve stejné řadě se nepřekrývají', () => {
    const layout = layoutTree(index, new Set(['adam']));
    const rada = layout.nodes.filter((n) => n.depth === 1).sort((a, b) => a.x - b.x);
    for (let i = 1; i < rada.length; i++) {
      expect(rada[i].x - rada[i - 1].x).toBeGreaterThanOrEqual(NODE_WIDTH + NODE_GAP_X);
    }
  });

  it('větev se přisadí těsně k páteři, i když se níž rozbalí jiná', () => {
    // Páteř a–b–c; „a“ má před páteří syna x, „b“ má před páteří dva syny.
    const lide = [
      person('a', { spine: true }),
      person('b', { spine: true }),
      person('c', { spine: true }),
      person('x'),
      person('y1'),
      person('y2'),
    ];
    const vazby = [
      parent('a', 'x', { sortOrder: 1 }),
      parent('a', 'b', { sortOrder: 2 }),
      parent('b', 'y1', { sortOrder: 1 }),
      parent('b', 'y2', { sortOrder: 2 }),
      parent('b', 'c', { sortOrder: 3 }),
    ];
    const i = buildKinIndex(lide, vazby, { includeUnverified: true });
    const layout = layoutTree(i, new Set(['a', 'b']));
    expect(xOf(layout, 'b')! - xOf(layout, 'x')!).toBe(NODE_WIDTH + NODE_GAP_X);
    expect(xOf(layout, 'y1')!).toBeLessThan(xOf(layout, 'y2')!);
    expect(xOf(layout, 'c')! - xOf(layout, 'y2')!).toBe(NODE_WIDTH + NODE_GAP_X);
  });

  it('větve z různých pater se o místo nepřetlačují přes sebe', () => {
    // Kainova linie sahá hluboko; větev z nižšího patra ji musí obejít.
    const lide = [
      person('a', { spine: true }),
      person('b', { spine: true }),
      person('c', { spine: true }),
      person('k1'),
      person('k2'),
      person('m'),
    ];
    const vazby = [
      parent('a', 'k1', { sortOrder: 1 }),
      parent('a', 'b', { sortOrder: 2 }),
      parent('k1', 'k2'),
      parent('b', 'm', { sortOrder: 1 }),
      parent('b', 'c', { sortOrder: 2 }),
    ];
    const i = buildKinIndex(lide, vazby, { includeUnverified: true });
    const layout = layoutTree(i, new Set(['a', 'b']));
    const obsazeno = new Set(layout.nodes.map((n) => `${n.depth}:${n.x}`));
    expect(obsazeno.size).toBe(layout.nodes.length);
    expect(xOf(layout, 'm')!).toBeLessThan(xOf(layout, 'k2')!);
  });

  it('hluboká větev, která se dole rozšiřuje, nezalehne páteř', () => {
    // Kainova linie se o tři patra níž větví; páteř tam vede taky.
    const lide = [
      person('a', { spine: true }),
      person('b', { spine: true }),
      person('c', { spine: true }),
      person('d', { spine: true }),
      person('k'),
      person('l'),
      person('l1'),
      person('l2'),
      person('l3'),
    ];
    const vazby = [
      parent('a', 'k', { sortOrder: 1 }),
      parent('a', 'b', { sortOrder: 2 }),
      parent('b', 'c'),
      parent('c', 'd'),
      parent('k', 'l'),
      parent('l', 'l1', { sortOrder: 1 }),
      parent('l', 'l2', { sortOrder: 2 }),
      parent('l', 'l3', { sortOrder: 3 }),
    ];
    const i = buildKinIndex(lide, vazby, { includeUnverified: true });
    const layout = layoutTree(i, new Set(['a', 'l']));
    expect(xOf(layout, 'd')! - xOf(layout, 'l3')!).toBeGreaterThanOrEqual(NODE_WIDTH + NODE_GAP_X);
  });

  it('cyklus v datech rozvržení nezacyklí', () => {
    const lide = [person('a', { spine: true }), person('b'), person('c')];
    const vazby = [parent('a', 'b'), parent('b', 'c'), parent('c', 'b')];
    const i = buildKinIndex(lide, vazby, { includeUnverified: true });
    expect(() => layoutTree(i, new Set(['a', 'b', 'c']))).not.toThrow();
  });
});

describe('neověřené vazby', () => {
  it('nepřihlášený je nevidí', () => {
    const vazby = [parent('adam', 'set'), parent('set', 'enos', { verified: false })];
    const verejne = buildKinIndex(persons, vazby, { includeUnverified: false });
    expect(layoutTree(verejne, new Set()).nodes.map((n) => n.id)).toEqual(['adam', 'set']);
  });
});

describe('odhalení osoby', () => {
  it('řekne, koho rozbalit', () => {
    expect(expansionsToReveal(index, 'irad')).toEqual(['adam']);
    expect(expansionsToReveal(index, 'enos')).toEqual([]);
  });

  it('osoba mimo strom nemá co rozbalit', () => {
    expect(expansionsToReveal(index, 'eva')).toBeNull();
  });
});

describe('příbuzní', () => {
  it('sourozenci se počítají ze společných rodičů a neopakují se', () => {
    expect(relativesOf(index, 'set').siblings.sort()).toEqual(['abel', 'kain']);
  });

  it('manželství platí z obou stran', () => {
    expect(relativesOf(index, 'eva').spouses[0].personId).toBe('adam');
    expect(relativesOf(index, 'adam').spouses[0].personId).toBe('eva');
  });
});
