/**
 * Rodokmen: index příbuzenství a rozvržení stromu.
 *
 * Čistá logika bez DOM, stejně jako rozvržení osy — kreslí až
 * `components/GenealogyView.tsx`.
 *
 * **Strom, i když data strom nejsou.** Dítě má dva rodiče a prameny se někdy
 * rozcházejí (Šealtiel je podle Matouše syn Jehojakina, podle Lukáše Neriho).
 * Ve stromu proto každá osoba visí pod jedním, *hlavním* rodičem; ostatní
 * vazby se nekreslí čarou, ale ukážou se v detailu osoby. Čáry přes celý
 * strom by z něj udělaly síť.
 *
 * **Páteř a sbalené větve.** Na začátku je vidět jen hlavní linie
 * (`Person.spine`). Kde se rodina větví, nese osoba počet schovaných dětí a
 * větev se rozbalí až na požádání — plakát se vším najednou je na obrazovce
 * nečitelný. Páteř drží svislou přímku: rodič stojí přesně nad svým
 * potomkem na páteři, ať se kolem rozbalí cokoli.
 */

import type { Person, Relation } from '../data/types';

/** Druhy vazby, které říkají „from je o generaci (nebo víc) nad to“. */
const PARENT_KINDS: ReadonlySet<Relation['kind']> = new Set(['rodic', 'pestoun', 'predek']);

export interface KinIndex {
  persons: Map<string, Person>;
  /** vazby, ve kterých je osoba dítětem */
  parents: Map<string, Relation[]>;
  /** vazby, ve kterých je osoba rodičem; seřazené podle pořadí dětí */
  children: Map<string, Relation[]>;
  spouses: Map<string, Relation[]>;
}

function pushTo(map: Map<string, Relation[]>, key: string, relation: Relation) {
  const list = map.get(key);
  if (list) list.push(relation);
  else map.set(key, [relation]);
}

/**
 * `includeUnverified: false` zahodí vazby, které člověk ještě neověřil —
 * tak rodokmen vidí nepřihlášený návštěvník.
 */
export function buildKinIndex(
  persons: readonly Person[],
  relations: readonly Relation[],
  options: { includeUnverified: boolean },
): KinIndex {
  const index: KinIndex = {
    persons: new Map(persons.map((person) => [person.id, person])),
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
  };
  for (const relation of relations) {
    if (!options.includeUnverified && !relation.verified) continue;
    if (!index.persons.has(relation.fromPerson) || !index.persons.has(relation.toPerson)) continue;
    if (PARENT_KINDS.has(relation.kind)) {
      pushTo(index.parents, relation.toPerson, relation);
      pushTo(index.children, relation.fromPerson, relation);
    } else {
      pushTo(index.spouses, relation.fromPerson, relation);
      pushTo(index.spouses, relation.toPerson, relation);
    }
  }
  const name = (id: string) => index.persons.get(id)?.name ?? '';
  for (const list of index.children.values()) {
    list.sort(
      (a, b) => a.sortOrder - b.sortOrder || name(a.toPerson).localeCompare(name(b.toPerson), 'cs'),
    );
  }
  return index;
}

/**
 * Vazba na hlavního rodiče — toho, pod kterým osoba ve stromu visí.
 * Osoba na páteři patří pod rodiče na páteři; jinak má přednost otec
 * (rodové linie v Bibli jdou po otcích) a nakonec pořadí podle id, aby
 * výsledek nezávisel na pořadí načtení.
 */
export function primaryParentRelation(index: KinIndex, personId: string): Relation | null {
  const relations = index.parents.get(personId);
  if (!relations || relations.length === 0) return null;
  const person = index.persons.get(personId);
  const score = (relation: Relation) => {
    const parent = index.persons.get(relation.fromPerson);
    return (
      (person?.spine && parent?.spine ? 4 : 0) + (parent?.gender === 'm' ? 2 : 0) + (relation.kind === 'rodic' ? 1 : 0)
    );
  };
  return [...relations].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
}

/** Děti, které ve stromu visí pod touhle osobou (je jejich hlavním rodičem). */
export function treeChildren(index: KinIndex, personId: string): Relation[] {
  return (index.children.get(personId) ?? []).filter(
    (relation) => primaryParentRelation(index, relation.toPerson)?.id === relation.id,
  );
}

/**
 * Je dítě vidět bez rozbalení rodiče? Páteř vždy. Mimo páteř teče dál i
 * řada jedináčků: Lukášova linie od Natana má dvacet generací po jednom
 * synovi a dvacetkrát klepat by nikdo nechtěl.
 */
function alwaysVisible(index: KinIndex, parentId: string, childId: string, siblingCount: number): boolean {
  const parent = index.persons.get(parentId);
  const child = index.persons.get(childId);
  if (parent?.spine && child?.spine) return true;
  return !parent?.spine && siblingCount === 1;
}

/** Kořeny stromů: osoby bez rodiče, pod kterými někdo visí. Páteř první. */
export function treeRoots(index: KinIndex): string[] {
  const roots: string[] = [];
  for (const person of index.persons.values()) {
    if (primaryParentRelation(index, person.id)) continue;
    if (treeChildren(index, person.id).length > 0) roots.push(person.id);
  }
  const spine = (id: string) => (index.persons.get(id)?.spine ? 0 : 1);
  const name = (id: string) => index.persons.get(id)?.name ?? '';
  return roots.sort((a, b) => spine(a) - spine(b) || name(a).localeCompare(name(b), 'cs'));
}

// ---------------------------------------------------------------------------
// Rozvržení
// ---------------------------------------------------------------------------

export const NODE_WIDTH = 150;
export const NODE_HEIGHT = 54;
export const NODE_GAP_X = 16;
export const NODE_GAP_Y = 30;
/** Mezera mezi samostatnými stromy vedle sebe. */
export const TREE_GAP = 56;

export interface TreeNode {
  id: string;
  /** levý horní roh karty */
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
  /** vazba na hlavního rodiče – nese jistotu a ověření pro styl čáry */
  relation: Relation | null;
  /** kolik dětí je schovaných za sbalenou větví */
  hidden: number;
  /** má větev, kterou jde rozbalit nebo sbalit */
  foldable: boolean;
  expanded: boolean;
}

export interface TreeLayout {
  nodes: TreeNode[];
  width: number;
  height: number;
}

/** Krajní polohy karet v jedné řadě stromu. */
interface Extent {
  min: number;
  max: number;
}

/**
 * Páteř stojí na jedné svislici a větve se k ní přisazují z obou stran:
 * sourozenci před potomkem na páteři doleva, ostatní doprava. Každá větev se
 * přirazí tak těsně, jak dovolí to, co už na její straně v dotčených řadách
 * stojí (obrys). Bez obrysu by rozbalení dvanácti Jákobových synů odsunulo
 * Kaina o půl obrazovky od Adama.
 */
export function layoutTree(index: KinIndex, expanded: ReadonlySet<string>): TreeLayout {
  const nodes = new Map<string, TreeNode>();

  const visibleChildren = (id: string) => {
    const all = treeChildren(index, id);
    const fixed = all.filter((child) => alwaysVisible(index, id, child.toPerson, all.length));
    const open = expanded.has(id);
    return { all, visible: open ? all : fixed, foldable: all.length > fixed.length, open };
  };

  const makeNode = (id: string, depth: number, x: number, parentId: string | null, relation: Relation | null) => {
    const { all, visible, foldable, open } = visibleChildren(id);
    const node: TreeNode = {
      id,
      x,
      y: depth * (NODE_HEIGHT + NODE_GAP_Y),
      depth,
      parentId,
      relation,
      hidden: all.length - visible.length,
      foldable,
      expanded: open,
    };
    // Zápis před dětmi: cyklus v datech (osoba vlastním předkem) by jinak
    // rekurzi nikdy nezastavil.
    nodes.set(id, node);
    return { node, visible };
  };

  /** Obyčejný podstrom: rozmístí se od `left` doprava, rodič nad středem dětí. */
  const place = (
    id: string,
    depth: number,
    left: number,
    parentId: string | null,
    relation: Relation | null,
    into: TreeNode[],
  ): number => {
    const { node, visible } = makeNode(id, depth, left, parentId, relation);
    into.push(node);
    let cursor = left;
    const placed: TreeNode[] = [];
    for (const child of visible) {
      if (nodes.has(child.toPerson)) continue;
      cursor += place(child.toPerson, depth + 1, cursor, id, child, into) + NODE_GAP_X;
      placed.push(nodes.get(child.toPerson)!);
    }
    if (placed.length === 0) return NODE_WIDTH;
    node.x = (placed[0].x + placed[placed.length - 1].x) / 2;
    return Math.max(cursor - NODE_GAP_X - left, NODE_WIDTH);
  };

  const extentsOf = (list: readonly TreeNode[]) => {
    const extents = new Map<number, Extent>();
    for (const node of list) {
      const extent = extents.get(node.depth);
      if (extent) {
        extent.min = Math.min(extent.min, node.x);
        extent.max = Math.max(extent.max, node.x);
      } else extents.set(node.depth, { min: node.x, max: node.x });
    }
    return extents;
  };

  /** Strom s páteří: páteř na x = 0, větve přisazené k obrysu. */
  const placeSpine = (rootId: string, into: TreeNode[]) => {
    /** krajní obsazená poloha v každé řadě, zvlášť vlevo a vpravo od páteře */
    const leftEdge = new Map<number, number>();
    const rightEdge = new Map<number, number>();
    const step = NODE_WIDTH + NODE_GAP_X;

    const attach = (child: Relation, depth: number, parentId: string, side: 'left' | 'right') => {
      if (nodes.has(child.toPerson)) return;
      const branch: TreeNode[] = [];
      place(child.toPerson, depth, 0, parentId, child, branch);
      const extents = extentsOf(branch);
      let shift = side === 'right' ? -Infinity : Infinity;
      for (const [row, extent] of extents) {
        // Řada, kam páteř ještě nedošla, se počítá jako obsazená páteří:
        // jde se shora, takže hluboká větev by jí jinak zalehla místo.
        if (side === 'right') shift = Math.max(shift, (rightEdge.get(row) ?? 0) + step - extent.min);
        else shift = Math.min(shift, (leftEdge.get(row) ?? 0) - step - extent.max);
      }
      for (const node of branch) node.x += shift;
      for (const [row, extent] of extents) {
        if (side === 'right') rightEdge.set(row, extent.max + shift);
        else leftEdge.set(row, extent.min + shift);
      }
      into.push(...branch);
    };

    let current: { id: string; parentId: string | null; relation: Relation | null } | null = {
      id: rootId,
      parentId: null,
      relation: null,
    };
    let depth = 0;
    while (current) {
      const { node, visible } = makeNode(current.id, depth, 0, current.parentId, current.relation);
      into.push(node);
      leftEdge.set(depth, Math.min(leftEdge.get(depth) ?? 0, 0));
      rightEdge.set(depth, Math.max(rightEdge.get(depth) ?? 0, 0));

      const next = visible.findIndex(
        (child) => index.persons.get(child.toPerson)?.spine && !nodes.has(child.toPerson),
      );
      // Potomek na páteři si drží místo dřív, než se k řadě přisadí větve.
      if (next >= 0) {
        leftEdge.set(depth + 1, Math.min(leftEdge.get(depth + 1) ?? 0, 0));
        rightEdge.set(depth + 1, Math.max(rightEdge.get(depth + 1) ?? 0, 0));
      }
      const before = next >= 0 ? visible.slice(0, next) : [];
      const after = next >= 0 ? visible.slice(next + 1) : visible;
      // Vlevo od nejbližšího k páteři, aby pořadí zleva doprava zůstalo.
      for (const child of [...before].reverse()) attach(child, depth + 1, node.id, 'left');
      for (const child of after) attach(child, depth + 1, node.id, 'right');

      current = next >= 0 ? { id: visible[next].toPerson, parentId: node.id, relation: visible[next] } : null;
      depth += 1;
    }
  };

  let offset = 0;
  for (const root of treeRoots(index)) {
    if (nodes.has(root)) continue;
    const tree: TreeNode[] = [];
    if (index.persons.get(root)?.spine) placeSpine(root, tree);
    else place(root, 0, 0, null, null, tree);
    const min = Math.min(...tree.map((node) => node.x));
    const max = Math.max(...tree.map((node) => node.x));
    for (const node of tree) node.x += offset - min;
    offset += max - min + NODE_WIDTH + TREE_GAP;
  }

  const list = [...nodes.values()];
  return {
    nodes: list,
    width: list.length === 0 ? 0 : Math.max(...list.map((node) => node.x)) + NODE_WIDTH,
    height: list.length === 0 ? 0 : Math.max(...list.map((node) => node.y)) + NODE_HEIGHT,
  };
}

/**
 * Koho rozbalit, aby byla osoba ve stromu vidět. `null`, když ve stromu není
 * vůbec — typicky manželka bez známých rodičů; ta má jen detail.
 */
export function expansionsToReveal(index: KinIndex, personId: string): string[] | null {
  const toExpand: string[] = [];
  const seen = new Set<string>();
  let current = personId;
  for (;;) {
    if (seen.has(current)) return null;
    seen.add(current);
    const relation = primaryParentRelation(index, current);
    if (!relation) break;
    const parent = relation.fromPerson;
    const siblings = treeChildren(index, parent).length;
    if (!alwaysVisible(index, parent, current, siblings)) toExpand.push(parent);
    current = parent;
  }
  const inTree = current !== personId || treeChildren(index, personId).length > 0;
  return inTree ? toExpand : null;
}

/** Všichni, kdo mají co rozbalit — pro tlačítko „Rozbalit vše“. */
export function allFoldable(index: KinIndex): string[] {
  const result: string[] = [];
  for (const id of index.persons.keys()) {
    const all = treeChildren(index, id);
    if (all.some((child) => !alwaysVisible(index, id, child.toPerson, all.length))) result.push(id);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Příbuzní jedné osoby (detail)
// ---------------------------------------------------------------------------

export interface Relatives {
  parents: Relation[];
  spouses: Array<{ relation: Relation; personId: string }>;
  children: Relation[];
  /** sourozenci se neukládají, počítají se ze společných rodičů */
  siblings: string[];
}

export function relativesOf(index: KinIndex, personId: string): Relatives {
  const parents = index.parents.get(personId) ?? [];
  const siblings: string[] = [];
  for (const parent of parents) {
    for (const child of index.children.get(parent.fromPerson) ?? []) {
      if (child.toPerson !== personId && !siblings.includes(child.toPerson)) siblings.push(child.toPerson);
    }
  }
  return {
    parents,
    spouses: (index.spouses.get(personId) ?? []).map((relation) => ({
      relation,
      personId: relation.fromPerson === personId ? relation.toPerson : relation.fromPerson,
    })),
    children: index.children.get(personId) ?? [],
    siblings,
  };
}

/** Jméno s rozlišovačem – jen tam, kde by se jména pletla. */
export function personLabel(person: Person): string {
  return person.qualifier ? `${person.name} (${person.qualifier})` : person.name;
}
