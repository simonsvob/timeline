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
 * **Řady nejsou generace od Adama.** Dítě stojí pod *všemi* svými rodiči a
 * manželé vedle sebe, takže se kratší linie natáhne: Marie má podle Lukáše
 * víc předků než Josef podle Matouše, a aby stáli vedle sebe nad Ježíšem,
 * dostane Josef delší čáru od otce.
 *
 * **Manželky bez známých rodičů** vlastní místo ve stromu nemají; přisadí se
 * vedle manžela. Děti k matce ukáže výběr osoby, ne dvanáct dalších čar.
 *
 * **Páteř** (`Person.spine`) drží svislou přímku, větve se k ní přisazují
 * z obou stran. Všechno je rozbalené; sbalit jde jednotlivé větve.
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
  /** manželé a ti, s kým má osoba společné dítě (i bez zapsaného manželství) */
  partners: Map<string, string[]>;
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
    partners: new Map(),
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
  const addPartner = (a: string, b: string) => {
    if (a === b) return;
    const list = index.partners.get(a);
    if (!list) index.partners.set(a, [b]);
    else if (!list.includes(b)) list.push(b);
  };
  for (const [id, list] of index.spouses) {
    for (const relation of list) addPartner(id, relation.fromPerson === id ? relation.toPerson : relation.fromPerson);
  }
  for (const list of index.parents.values()) {
    for (const a of list) for (const b of list) addPartner(a.fromPerson, b.fromPerson);
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
export const NODE_GAP_Y = 38;
/** Mezera mezi samostatnými stromy vedle sebe. */
export const TREE_GAP = 56;

export interface TreeNode {
  id: string;
  /** levý horní roh karty */
  x: number;
  y: number;
  /** řada; rodič bývá o jednu výš, u natažené linie o víc */
  row: number;
  parentId: string | null;
  /** vazba na hlavního rodiče – nese jistotu a ověření pro styl čáry */
  relation: Relation | null;
  /** kolik dětí je schovaných za sbalenou větví */
  hidden: number;
  /** má větev, kterou jde sbalit nebo rozbalit */
  foldable: boolean;
  expanded: boolean;
  /** partner bez vlastního místa ve stromu: u koho je přisazený */
  attachedTo: string | null;
}

/** Čára mimo kostru stromu: manželství, nebo druhý rodič. */
export interface TreeLink {
  kind: 'marriage' | 'parent';
  from: string;
  to: string;
  /** `null` u partnerů bez zapsaného manželství (společné dítě) */
  relation: Relation | null;
}

export interface TreeLayout {
  nodes: TreeNode[];
  links: TreeLink[];
  width: number;
  height: number;
}

/** Krajní polohy karet v jedné řadě stromu. */
interface Extent {
  min: number;
  max: number;
}

const STEP = NODE_WIDTH + NODE_GAP_X;
const ROW = NODE_HEIGHT + NODE_GAP_Y;

/**
 * `collapsed` jsou osoby se sbalenou větví; všechno ostatní je rozbalené.
 */
export function layoutTree(index: KinIndex, collapsed: ReadonlySet<string>): TreeLayout {
  // --- 1. kostra: kdo je vidět a pod kým visí -------------------------------
  const treeParent = new Map<string, { id: string; relation: Relation } | null>();
  const kids = new Map<string, Relation[]>();
  const hiddenCount = new Map<string, number>();
  const foldableIds = new Set<string>();
  const order: string[] = [];
  const roots = treeRoots(index);
  const walk = (id: string, parent: { id: string; relation: Relation } | null) => {
    // Zápis před dětmi: cyklus v datech by jinak rekurzi nezastavil.
    treeParent.set(id, parent);
    order.push(id);
    const all = treeChildren(index, id);
    const fixed = all.filter((child) => alwaysVisible(index, id, child.toPerson, all.length));
    const visible = (collapsed.has(id) ? fixed : all).filter((child) => !treeParent.has(child.toPerson));
    kids.set(id, visible);
    hiddenCount.set(id, all.length - visible.length);
    if (all.length > fixed.length) foldableIds.add(id);
    for (const child of visible) walk(child.toPerson, { id, relation: child });
  };
  for (const root of roots) if (!treeParent.has(root)) walk(root, null);

  // --- 2. řady ---------------------------------------------------------------
  const isAncestor = (ancestor: string, id: string) => {
    for (let at = treeParent.get(id); at; at = treeParent.get(at.id)) if (at.id === ancestor) return true;
    return false;
  };
  const row = new Map<string, number>(order.map((id) => [id, 0]));
  /**
   * Řada osoby, která vlastní místo nemá (manželka bez rodičů): řada toho,
   * vedle koho se přisadí. Bez toho by Machlon nevěděl, že má stát vedle Rut,
   * a Elimelekova rodina by visela nahoře u Adama.
   */
  const rowOf = (id: string, asking: string): number | undefined => {
    const own = row.get(id);
    if (own !== undefined || primaryParentRelation(index, id)) return own;
    let best: number | undefined;
    for (const partner of index.partners.get(id) ?? []) {
      // Tamar je manželkou Judy i jeho synů Era a Onana; přes ni by se Juda
      // tlačil pod vlastní syny a řady by rostly donekonečna.
      if (partner === asking || isAncestor(asking, partner) || isAncestor(partner, asking)) continue;
      const other = row.get(partner);
      if (other !== undefined && (best === undefined || other > best)) best = other;
    }
    return best;
  };
  /** Víc řad, než je osob, legitimně vzniknout nemůže – jen zacyklením dat. */
  const maxRow = order.length;
  /** Osoby vedlejších stromů, potomci před předky. */
  const sideOrder: string[] = [];
  const collectSide = (id: string) => {
    sideOrder.push(id);
    for (const child of kids.get(id) ?? []) collectSide(child.toPerson);
  };
  for (const root of roots) if (!index.persons.get(root)?.spine) collectSide(root);
  sideOrder.reverse();
  // Dva kroky dokola, dokud se něco hýbe; strop je pojistka proti datům, která
  // by se honila dokola (manžel vlastním potomkem přes druhou vazbu).
  for (let round = 0; round < 50; round++) {
    let moved = false;
    // Dolů: dítě pod všemi rodiči, manželé ve stejné řadě.
    for (let pass = 0; pass < 200; pass++) {
      let changed = false;
      for (const id of order) {
        let next = row.get(id)!;
        const parent = treeParent.get(id);
        if (parent) next = Math.max(next, row.get(parent.id)! + 1);
        for (const relation of index.parents.get(id) ?? []) {
          const other = row.get(relation.fromPerson);
          if (other !== undefined && !isAncestor(id, relation.fromPerson)) next = Math.max(next, other + 1);
        }
        for (const partner of index.partners.get(id) ?? []) {
          const other = rowOf(partner, id);
          if (other !== undefined && !isAncestor(id, partner) && !isAncestor(partner, id)) next = Math.max(next, other);
        }
        next = Math.min(next, maxRow);
        if (next !== row.get(id)) {
          row.set(id, next);
          changed = true;
          moved = true;
        }
      }
      if (!changed) break;
    }
    // Vedlejší strom (rodina bez známých předků) nezačíná nahoře u Adama, ale
    // těsně nad tím, kdo se do hlavní rodiny přivdal: Achitofel a Ammiel stojí
    // nad Bat-šebou, ne v řadě s Adamem. Stahuje se celá linie, od nejnižších
    // osob nahoru; ostatní děti pak sjedou s rodiči.
    let lifted = false;
    for (const id of sideOrder) {
      const below = (index.children.get(id) ?? [])
        .map((relation) => row.get(relation.toPerson))
        .filter((value): value is number => value !== undefined);
      if (below.length === 0) continue;
      const target = Math.min(Math.max(...below) - 1, maxRow);
      if (target > row.get(id)!) {
        row.set(id, target);
        lifted = true;
      }
    }
    if (!moved && !lifted) break;
  }

  // --- 3. partneři bez vlastního místa --------------------------------------
  const attached = new Map<string, string[]>();
  for (const person of index.persons.values()) {
    if (row.has(person.id) || primaryParentRelation(index, person.id)) continue;
    const hosts = (index.partners.get(person.id) ?? []).filter((id) => row.has(id));
    if (hosts.length === 0) continue;
    const shared = (host: string) =>
      (index.children.get(person.id) ?? []).filter((child) =>
        (index.parents.get(child.toPerson) ?? []).some((parent) => parent.fromPerson === host),
      ).length;
    const host = hosts.reduce((best, id) => (shared(id) > shared(best) ? id : best));
    const list = attached.get(host);
    if (list) list.push(person.id);
    else attached.set(host, [person.id]);
  }
  // Partner přisazené osoby (Nabal, první muž Abigail) jde ke stejnému hostiteli.
  const hostOf = new Map<string, string>();
  for (const [host, list] of attached) for (const id of list) hostOf.set(id, host);
  for (const person of index.persons.values()) {
    if (row.has(person.id) || hostOf.has(person.id) || primaryParentRelation(index, person.id)) continue;
    const via = (index.partners.get(person.id) ?? []).find((id) => hostOf.has(id));
    if (!via) continue;
    const host = hostOf.get(via)!;
    attached.get(host)!.push(person.id);
    hostOf.set(person.id, host);
  }
  // Manželky v pořadí svých prvních dětí (Lea před Ráchel), bezdětné na konec.
  const firstChild = (id: string) => Math.min(Infinity, ...(index.children.get(id) ?? []).map((child) => child.sortOrder));
  const nameOf = (id: string) => index.persons.get(id)?.name ?? '';
  for (const list of attached.values()) {
    list.sort((x, y) => {
      const a = firstChild(x);
      const b = firstChild(y);
      return (a === b ? 0 : a < b ? -1 : 1) || nameOf(x).localeCompare(nameOf(y), 'cs');
    });
  }

  // --- 4. vodorovné polohy ---------------------------------------------------
  const nodes = new Map<string, TreeNode>();
  const makeNode = (id: string, x: number): TreeNode => {
    const parent = treeParent.get(id) ?? null;
    const node: TreeNode = {
      id,
      x,
      y: row.get(id)! * ROW,
      row: row.get(id)!,
      parentId: parent?.id ?? null,
      relation: parent?.relation ?? null,
      hidden: hiddenCount.get(id) ?? 0,
      foldable: foldableIds.has(id),
      expanded: !collapsed.has(id),
      attachedTo: null,
    };
    nodes.set(id, node);
    return node;
  };
  const attach = (host: TreeNode, into: TreeNode[]) => {
    (attached.get(host.id) ?? []).forEach((id, i) => {
      const node: TreeNode = {
        id,
        x: host.x + (i + 1) * STEP,
        y: host.y,
        row: host.row,
        parentId: null,
        relation: null,
        hidden: 0,
        foldable: false,
        expanded: true,
        attachedTo: host.id,
      };
      nodes.set(id, node);
      into.push(node);
    });
  };

  /** Obyčejný podstrom: od `left` doprava, rodič nad středem dětí. Vrací šířku. */
  const place = (id: string, left: number, into: TreeNode[]): number => {
    const node = makeNode(id, left);
    into.push(node);
    let cursor = left;
    const placed: TreeNode[] = [];
    for (const child of kids.get(id) ?? []) {
      cursor += place(child.toPerson, cursor, into) + NODE_GAP_X;
      placed.push(nodes.get(child.toPerson)!);
    }
    if (placed.length > 0) node.x = (placed[0].x + placed[placed.length - 1].x) / 2;
    attach(node, into);
    const own = node.x - left + NODE_WIDTH + (attached.get(id)?.length ?? 0) * STEP;
    return Math.max(placed.length > 0 ? cursor - NODE_GAP_X - left : 0, own);
  };

  /**
   * Co větev v které řadě zabírá. Počítá se i svislá čára natažené linie:
   * prochází řadami, kde žádnou kartu nemá, a nesmí jí tam nic zalehnout.
   */
  const extentsOf = (list: readonly TreeNode[], parentRow: number) => {
    const extents = new Map<number, Extent>();
    const add = (r: number, x: number) => {
      const extent = extents.get(r);
      if (extent) {
        extent.min = Math.min(extent.min, x);
        extent.max = Math.max(extent.max, x);
      } else extents.set(r, { min: x, max: x });
    };
    for (const node of list) {
      add(node.row, node.x);
      if (node.attachedTo) continue;
      const above = node.parentId ? (nodes.get(node.parentId)?.row ?? parentRow) : parentRow;
      for (let r = above + 1; r < node.row; r++) add(r, node.x);
    }
    return extents;
  };

  /** Obrys hlavního stromu: krajní obsazená poloha v každé řadě, zvlášť vlevo a vpravo. */
  const leftEdge = new Map<number, number>();
  const rightEdge = new Map<number, number>();

  /** Přisadí hotovou větev k obrysu z jedné strany tak těsně, jak to jde. */
  const pack = (branch: TreeNode[], parentRow: number, where: 'left' | 'right') => {
    const extents = extentsOf(branch, parentRow);
    let shift = where === 'right' ? -Infinity : Infinity;
    for (const [r, extent] of extents) {
      // Řada bez záznamu patří páteři: buď tam stojí, nebo jí tam vede čára.
      if (where === 'right') shift = Math.max(shift, (rightEdge.get(r) ?? 0) + STEP - extent.min);
      else shift = Math.min(shift, (leftEdge.get(r) ?? 0) - STEP - extent.max);
    }
    for (const node of branch) node.x += shift;
    for (const [r, extent] of extents) {
      if (where === 'right') rightEdge.set(r, extent.max + shift);
      else leftEdge.set(r, extent.min + shift);
    }
  };

  /** Strom s páteří: páteř na x = 0, větve přisazené k obrysu z obou stran. */
  const placeSpine = (rootId: string, into: TreeNode[]) => {

    // Nejdřív celá páteř i s manželkami – drží si místo dřív, než se k ní
    // začnou přisazovat větve, které sahají o desítky řad níž.
    const chain: TreeNode[] = [];
    for (let id: string | undefined = rootId; id; ) {
      const node = makeNode(id, 0);
      chain.push(node);
      into.push(node);
      attach(node, into);
      rightEdge.set(node.row, (attached.get(id)?.length ?? 0) * STEP);
      id = (kids.get(id) ?? []).find((child) => index.persons.get(child.toPerson)?.spine)?.toPerson;
    }

    const side = (child: Relation, parent: TreeNode, where: 'left' | 'right') => {
      const branch: TreeNode[] = [];
      place(child.toPerson, 0, branch);
      pack(branch, parent.row, where);
      into.push(...branch);
    };

    chain.forEach((node, i) => {
      const children = kids.get(node.id) ?? [];
      const next = chain[i + 1] ? children.findIndex((child) => child.toPerson === chain[i + 1].id) : -1;
      const before = next >= 0 ? children.slice(0, next) : [];
      const after = next >= 0 ? children.slice(next + 1) : children;
      // Vlevo od nejbližšího k páteři, aby pořadí zleva doprava zůstalo.
      for (const child of [...before].reverse()) side(child, node, 'left');
      for (const child of after) side(child, node, 'right');
    });
  };

  /**
   * Na kterou stranu páteře patří vedlejší strom: tam, kde stojí někdo, s kým
   * je spřízněný (Jetro k Mojžíšovi vlevo, Anna k Helimu vpravo).
   */
  const sideFor = (branch: readonly TreeNode[]): 'left' | 'right' => {
    const own = new Set(branch.map((node) => node.id));
    for (const node of branch) {
      const kin = [
        ...(index.partners.get(node.id) ?? []),
        ...(index.parents.get(node.id) ?? []).map((relation) => relation.fromPerson),
        ...(index.children.get(node.id) ?? []).map((relation) => relation.toPerson),
      ];
      for (const id of kin) {
        const other = nodes.get(id);
        if (other && !own.has(id)) return other.x < 0 ? 'left' : 'right';
      }
    }
    return 'right';
  };

  // Strom s páteří se staví první; vedlejší stromy (rodiny bez známých předků,
  // které se do hlavní přivdaly) se k němu přisadí obrysem jako další větve.
  // Kdyby stály až za ním, vedly by jejich manželské čáry přes celou plochu.
  const ordered = [...roots].sort(
    (a, b) => Number(Boolean(index.persons.get(b)?.spine)) - Number(Boolean(index.persons.get(a)?.spine)),
  );
  const hasSpineTree = ordered.length > 0 && Boolean(index.persons.get(ordered[0])?.spine);
  if (hasSpineTree) {
    for (const root of ordered) {
      if (nodes.has(root)) continue;
      const tree: TreeNode[] = [];
      if (index.persons.get(root)?.spine) placeSpine(root, tree);
      else {
        place(root, 0, tree);
        pack(tree, row.get(root)! - 1, sideFor(tree));
      }
    }
  } else {
    // Bez páteře (jen vedlejší stromy) stojí stromy vedle sebe.
    let offset = 0;
    for (const root of ordered) {
      if (nodes.has(root)) continue;
      const tree: TreeNode[] = [];
      place(root, 0, tree);
      const min = Math.min(...tree.map((node) => node.x));
      const max = Math.max(...tree.map((node) => node.x));
      for (const node of tree) node.x += offset - min;
      offset += max - min + NODE_WIDTH + TREE_GAP;
    }
  }
  // Levý okraj na nulu: páteř stojí na x = 0 a větve sahají do záporu.
  const minX = Math.min(0, ...[...nodes.values()].map((node) => node.x));
  for (const node of nodes.values()) node.x -= minX;

  // --- 5. čáry mimo kostru ---------------------------------------------------
  const links: TreeLink[] = [];
  const married = new Set<string>();
  for (const list of index.spouses.values()) {
    for (const relation of list) {
      if (married.has(relation.id)) continue;
      married.add(relation.id);
      if (nodes.has(relation.fromPerson) && nodes.has(relation.toPerson)) {
        links.push({ kind: 'marriage', from: relation.fromPerson, to: relation.toPerson, relation });
      }
    }
  }
  for (const node of nodes.values()) {
    if (node.attachedTo) {
      // Přisazená matka bez zapsaného manželství (Tamar u Judy).
      const wed = (index.spouses.get(node.id) ?? []).some(
        (r) => r.fromPerson === node.attachedTo || r.toPerson === node.attachedTo,
      );
      if (!wed) links.push({ kind: 'marriage', from: node.attachedTo, to: node.id, relation: null });
      continue;
    }
    for (const relation of index.parents.get(node.id) ?? []) {
      if (relation.id === node.relation?.id) continue;
      const parent = nodes.get(relation.fromPerson);
      // Matku přisazenou vedle otce říká sousedství; čára by jen přidala šum.
      if (!parent || (parent.attachedTo && parent.attachedTo === node.parentId)) continue;
      links.push({ kind: 'parent', from: relation.fromPerson, to: node.id, relation });
    }
  }

  const list = [...nodes.values()];
  return {
    nodes: list,
    links,
    width: list.length === 0 ? 0 : Math.max(...list.map((node) => node.x)) + NODE_WIDTH,
    height: list.length === 0 ? 0 : Math.max(...list.map((node) => node.y)) + NODE_HEIGHT,
  };
}

/**
 * Čí větve nesmí být sbalené, aby byla osoba ve stromu vidět. Partner bez
 * vlastního místa se ukáže u toho, ke komu patří. `null`, když osobu strom
 * ukázat neumí vůbec.
 */
export function expansionsToReveal(index: KinIndex, personId: string): string[] | null {
  const own = ancestorsToOpen(index, personId);
  if (own) return own;
  for (const partner of index.partners.get(personId) ?? []) {
    const viaPartner = ancestorsToOpen(index, partner);
    if (viaPartner) return viaPartner;
  }
  return null;
}

function ancestorsToOpen(index: KinIndex, personId: string): string[] | null {
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

/** Všichni, kdo mají co sbalit — pro tlačítko „Sbalit vše“. */
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
