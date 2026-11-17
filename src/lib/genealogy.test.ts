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

const ALL = ['adam'];

describe('rozvržení stromu', () => {
  it('všechno je rozbalené, dokud se větev nesbalí', () => {
    const open = layoutTree(index, new Set());
    expect(open.nodes.filter((n) => !n.attachedTo).map((n) => n.id).sort()).toEqual(
      ['abel', 'adam', 'enoch-kainuv', 'enos', 'irad', 'kain', 'set'].sort(),
    );
    const closed = layoutTree(index, new Set(ALL));
    expect(closed.nodes.filter((n) => !n.attachedTo).map((n) => n.id)).toEqual(['adam', 'set', 'enos']);
    const adam = closed.nodes[0];
    expect(adam.hidden).toBe(2);
    expect(adam.foldable).toBe(true);
    expect(adam.expanded).toBe(false);
  });

  it('páteř drží svislou přímku i s rozbalenými větvemi', () => {
    const layout = layoutTree(index, new Set());
    expect(xOf(layout, 'adam')).toBe(xOf(layout, 'set'));
    expect(xOf(layout, 'set')).toBe(xOf(layout, 'enos'));
  });

  it('děti stojí v uloženém pořadí, ne podle abecedy', () => {
    const layout = layoutTree(index, new Set());
    expect(xOf(layout, 'kain')!).toBeLessThan(xOf(layout, 'abel')!);
    expect(xOf(layout, 'abel')!).toBeLessThan(xOf(layout, 'set')!);
  });

  it('manželka bez známých rodičů stojí hned vedle manžela', () => {
    const layout = layoutTree(index, new Set());
    const eva = layout.nodes.find((n) => n.id === 'eva')!;
    expect(eva.attachedTo).toBe('adam');
    expect(eva.row).toBe(0);
    expect(eva.x - xOf(layout, 'adam')!).toBe(NODE_WIDTH + NODE_GAP_X);
    expect(layout.links).toContainEqual(expect.objectContaining({ kind: 'marriage', from: 'adam', to: 'eva' }));
    // Děti k matce říká sousedství, čára navíc se nekreslí.
    expect(layout.links.filter((link) => link.kind === 'parent')).toEqual([]);
  });

  it('žádné dvě karty nestojí na stejném místě', () => {
    const layout = layoutTree(index, new Set());
    const cells = new Set(layout.nodes.map((n) => `${n.row}:${n.x}`));
    expect(cells.size).toBe(layout.nodes.length);
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a !== b && a.row === b.row) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(NODE_WIDTH + NODE_GAP_X);
      }
    }
  });

  it('větev se přisadí těsně k páteři a pořadí zůstane', () => {
    // Páteř a–b–c; „a“ má před páteří syna x, „b“ má před páteří dva syny.
    const lide = ['a', 'b', 'c'].map((id) => person(id, { spine: true })).concat(['x', 'y1', 'y2'].map((id) => person(id)));
    const vazby = [
      parent('a', 'x', { sortOrder: 1 }),
      parent('a', 'b', { sortOrder: 2 }),
      parent('b', 'y1', { sortOrder: 1 }),
      parent('b', 'y2', { sortOrder: 2 }),
      parent('b', 'c', { sortOrder: 3 }),
    ];
    const layout = layoutTree(buildKinIndex(lide, vazby, { includeUnverified: true }), new Set());
    expect(xOf(layout, 'b')! - xOf(layout, 'x')!).toBe(NODE_WIDTH + NODE_GAP_X);
    expect(xOf(layout, 'y1')!).toBeLessThan(xOf(layout, 'y2')!);
    expect(xOf(layout, 'c')! - xOf(layout, 'y2')!).toBe(NODE_WIDTH + NODE_GAP_X);
  });

  it('hluboká větev, která se dole rozšiřuje, nezalehne páteř', () => {
    const lide = ['a', 'b', 'c', 'd'].map((id) => person(id, { spine: true })).concat(['k', 'l', 'l1', 'l2', 'l3'].map((id) => person(id)));
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
    const layout = layoutTree(buildKinIndex(lide, vazby, { includeUnverified: true }), new Set());
    expect(xOf(layout, 'd')! - xOf(layout, 'l3')!).toBeGreaterThanOrEqual(NODE_WIDTH + NODE_GAP_X);
  });

  it('manželé z různě dlouhých linií stojí ve stejné řadě nad dítětem', () => {
    // Páteř d–s–j–jezis; druhá linie d–n1–n2–n3–marie je o generaci delší.
    const lide = [
      person('d', { spine: true }),
      person('s', { spine: true }),
      person('josef', { spine: true }),
      person('jezis', { spine: true }),
      person('n1'),
      person('n2'),
      person('marie', { gender: 'f' }),
    ];
    const vazby = [
      parent('d', 's', { sortOrder: 1 }),
      parent('d', 'n1', { sortOrder: 2 }),
      parent('s', 'josef'),
      parent('n1', 'n2'),
      parent('n2', 'marie'),
      parent('marie', 'jezis'),
      parent('josef', 'jezis', { kind: 'pestoun' }),
      { ...parent('josef', 'marie'), kind: 'manzelstvi' as const },
    ];
    const layout = layoutTree(buildKinIndex(lide, vazby, { includeUnverified: true }), new Set());
    const at = (id: string) => layout.nodes.find((n) => n.id === id)!;
    expect(at('josef').row).toBe(at('marie').row);
    expect(at('jezis').row).toBe(at('marie').row + 1);
    expect(at('jezis').parentId).toBe('josef');
    expect(at('marie').x - at('josef').x).toBe(NODE_WIDTH + NODE_GAP_X);
    expect(layout.links).toContainEqual(expect.objectContaining({ kind: 'parent', from: 'marie', to: 'jezis' }));
    expect(layout.links).toContainEqual(expect.objectContaining({ kind: 'marriage' }));
  });

  it('cyklus v datech rozvržení nezacyklí', () => {
    const lide = [person('a', { spine: true }), person('b'), person('c')];
    const vazby = [parent('a', 'b'), parent('b', 'c'), parent('c', 'b')];
    const i = buildKinIndex(lide, vazby, { includeUnverified: true });
    expect(() => layoutTree(i, new Set())).not.toThrow();
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

  it('manželka se ukáže u manžela; kdo nemá nikoho, strom ho ukázat neumí', () => {
    expect(expansionsToReveal(index, 'eva')).toEqual([]);
    const sam = buildKinIndex([...persons, person('nikdo')], relations, { includeUnverified: true });
    expect(expansionsToReveal(sam, 'nikdo')).toBeNull();
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
