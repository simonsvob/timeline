/**
 * Sekce Rodokmen: strom osob a panel vybrané osoby.
 *
 * Strom je samostatný pohled, ne vrstva na ose — čáry mezi příbuznými by osu
 * zahltily. S osou ho pojí proklik oběma směry: odsud „Ukázat na ose“,
 * z detailu záznamu „Ukázat v rodokmenu“.
 *
 * Polohy karet počítá `lib/genealogy.ts`; tady se jen kreslí. Karty jsou
 * obyčejné HTML nad jedním SVG s čarami: osob jsou stovky, ne tisíce, a
 * HTML dá zadarmo výběr textu, klávesnici i čtečky. Posouvá se nativním
 * scrollem, takže dotyk i trackpad fungují bez vlastních gest.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cs } from '../i18n/cs';
import { formatRange, formatRangeCompact } from '../lib/format';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  allFoldable,
  expansionsToReveal,
  layoutTree,
  personLabel,
  relativesOf,
  type KinIndex,
  type TreeNode,
} from '../lib/genealogy';
import {
  PERSON_ROLES,
  type Person,
  type PersonEventLink,
  type PersonRole,
  type Relation,
  type RelationCertainty,
  type RelationPatch,
  type TimelineEvent,
} from '../data/types';
import { RichText } from './RichText';

/** Okraj kolem stromu, aby krajní karty neležely na hraně plochy. */
const PAD_X = 48;
const PAD_TOP = 20;
const PAD_BOTTOM = 160;

/** Barvy rolí – jediné místo; popisky jsou v `cs.genealogy.roles`. */
export const ROLE_COLORS: Record<PersonRole, string> = {
  kral: '#a8813a',
  veleknez: '#7a77ba',
  soudce: '#6f7f3f',
  prorok: '#3a7ca8',
};

/** Co si rodokmen pamatuje přes přepnutí pohledu (drží `App`). */
export interface GenealogyViewState {
  expanded: string[];
  selectedId: string | null;
  lens: PersonRole | null;
  scrollLeft: number;
  scrollTop: number;
}

export interface GenealogyFocus {
  personId: string;
  nonce: number;
}

interface Props {
  kin: KinIndex;
  links: readonly PersonEventLink[];
  events: readonly TimelineEvent[];
  /** počet všech vazeb a kolik z nich je ověřených – jen pro přihlášeného */
  relationTotals: { total: number; verified: number };
  canEdit: boolean;
  focus: GenealogyFocus | null;
  onFocusApplied: () => void;
  saved: GenealogyViewState | null;
  onRemember: (state: GenealogyViewState) => void;
  onShowOnTimeline: (event: TimelineEvent) => void;
  onSaveRelation: (id: string, patch: RelationPatch) => Promise<Relation>;
}

interface PersonEvent {
  event: TimelineEvent;
  role: PersonEventLink['role'];
}

function isRole(value: string): value is PersonRole {
  return (PERSON_ROLES as readonly string[]).includes(value);
}

/** Hledání bez ohledu na velikost písmen a diakritiku („jesse“ najde Jišaje ne, ale „jisaj“ ano). */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('cs');
}

export function GenealogyView({
  kin,
  links,
  events,
  relationTotals,
  canEdit,
  focus,
  onFocusApplied,
  saved,
  onRemember,
  onShowOnTimeline,
  onSaveRelation,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(saved?.expanded ?? []));
  const [selectedId, setSelectedId] = useState<string | null>(saved?.selectedId ?? null);
  const [lens, setLens] = useState<PersonRole | null>(saved?.lens ?? null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  /**
   * Karta, která má po přepočtu zůstat pod prstem (rozbalení větve), a kde
   * na obrazovce ležela. Měří se v DOM, ne ze souřadnic stromu: úzký strom
   * je v ploše vystředěný a jeho šířka se rozbalením mění.
   */
  const anchorRef = useRef<{ id: string; left: number; top: number } | null>(null);
  /** Osoba, na kterou se má po přepočtu dojet (skok z osy, z hledání, z panelu). */
  const centerRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  const layout = useMemo(() => layoutTree(kin, expanded), [kin, expanded]);
  const nodeMap = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout]);

  const eventsByPerson = useMemo(() => {
    const byId = new Map(events.map((event) => [event.id, event]));
    const map = new Map<string, PersonEvent[]>();
    for (const link of links) {
      const event = byId.get(link.eventId);
      if (!event) continue;
      const list = map.get(link.personId);
      if (list) list.push({ event, role: link.role });
      else map.set(link.personId, [{ event, role: link.role }]);
    }
    return map;
  }, [links, events]);

  /** Role, které se ve stromu opravdu vyskytují – jen ty dostanou přepínač. */
  const rolesPresent = useMemo(() => {
    const present = new Set<PersonRole>();
    for (const person of kin.persons.values()) {
      for (const role of person.roles) if (isRole(role)) present.add(role);
    }
    return PERSON_ROLES.filter((role) => present.has(role));
  }, [kin]);

  const foldable = useMemo(() => allFoldable(kin), [kin]);
  const allExpanded = foldable.length > 0 && foldable.every((id) => expanded.has(id));

  const remember = useCallback(() => {
    const el = scrollRef.current;
    onRemember({
      expanded: [...expanded],
      selectedId,
      lens,
      scrollLeft: el?.scrollLeft ?? 0,
      scrollTop: el?.scrollTop ?? 0,
    });
  }, [expanded, selectedId, lens, onRemember]);

  useEffect(remember, [remember]);

  const centerOn = useCallback((node: TreeNode) => {
    const el = scrollRef.current;
    if (!el) return;
    const now = screenPosition(el, node.id);
    if (!now) return;
    const box = el.getBoundingClientRect();
    el.scrollTo({
      left: el.scrollLeft + now.left - box.left + NODE_WIDTH / 2 - el.clientWidth / 2,
      // Do horní třetiny: na telefonu spodek zakrývá panel osoby.
      top: el.scrollTop + now.top - box.top + NODE_HEIGHT / 2 - el.clientHeight / 3,
    });
  }, []);

  // Po každém přepočtu stromu: vrátit uloženou polohu, dojet na osobu, nebo
  // podržet kartu, na kterou se klepalo.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!restoredRef.current) {
      restoredRef.current = true;
      if (saved) {
        el.scrollLeft = saved.scrollLeft;
        el.scrollTop = saved.scrollTop;
      } else if (layout.nodes.length > 0) {
        // První otevření: začátek hlavní linie doprostřed nahoře.
        centerOn(layout.nodes[0]);
        el.scrollTop = 0;
      }
    }
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (anchor) {
      const now = screenPosition(el, anchor.id);
      if (now) {
        el.scrollLeft += now.left - anchor.left;
        el.scrollTop += now.top - anchor.top;
      }
    }
    const target = centerRef.current;
    if (target) {
      const node = nodeMap.get(target);
      if (node) {
        centerRef.current = null;
        centerOn(node);
      }
    }
    // `saved` se čte jen při připojení, stejně jako u osy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, nodeMap, centerOn]);

  /** Vybere osobu a postará se, aby byla ve stromu vidět. */
  const reveal = useCallback(
    (personId: string) => {
      setSelectedId(personId);
      const toExpand = expansionsToReveal(kin, personId);
      if (toExpand === null) return;
      centerRef.current = personId;
      setExpanded((prev) => {
        if (toExpand.every((id) => prev.has(id))) return new Set(prev);
        const next = new Set(prev);
        for (const id of toExpand) next.add(id);
        return next;
      });
    },
    [kin],
  );

  // Skok z osy je jednorázový – App ho po provedení zahodí.
  useEffect(() => {
    if (!focus) return;
    reveal(focus.personId);
    onFocusApplied();
  }, [focus, reveal, onFocusApplied]);

  const holdInPlace = (id: string) => {
    const el = scrollRef.current;
    const position = el ? screenPosition(el, id) : null;
    anchorRef.current = position ? { id, ...position } : null;
  };

  const toggleBranch = (node: TreeNode) => {
    holdInPlace(node.id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  const toggleAll = () => {
    const keep = (selectedId && nodeMap.get(selectedId)) || layout.nodes[0];
    if (keep) holdInPlace(keep.id);
    setExpanded(allExpanded ? new Set() : new Set(foldable));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Tažení myší. Dotyk a trackpad posouvají nativně; myš s kolečkem by se
  // jinak do stran nedostala.
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    const el = e.currentTarget;
    dragRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.currentTarget.scrollLeft = drag.left - (e.clientX - drag.x);
    e.currentTarget.scrollTop = drag.top - (e.clientY - drag.y);
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const suggestions = useMemo(() => {
    const needle = fold(query.trim());
    if (needle === '') return [];
    const hits: Person[] = [];
    for (const person of kin.persons.values()) {
      if ([person.name, ...person.altNames].some((name) => fold(name).includes(needle))) hits.push(person);
    }
    return hits.sort((a, b) => a.name.localeCompare(b.name, 'cs')).slice(0, 8);
  }, [kin, query]);

  const selected = selectedId ? (kin.persons.get(selectedId) ?? null) : null;

  if (layout.nodes.length === 0) {
    return (
      <div className="genealogy genealogy-empty">
        <p className="muted">{cs.genealogy.empty}</p>
      </div>
    );
  }

  return (
    <div className="genealogy">
      <div className="genealogy-stage">
        <div className="genealogy-toolbar">
          <div className="genealogy-search">
            <input
              className="input genealogy-search-input"
              type="search"
              value={query}
              placeholder={cs.genealogy.searchPlaceholder}
              aria-label={cs.genealogy.searchPlaceholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
            />
            {searchOpen && query.trim() !== '' ? (
              <ul className="genealogy-suggestions">
                {suggestions.length === 0 ? (
                  <li className="genealogy-suggestion-empty">{cs.genealogy.noSearchResults}</li>
                ) : (
                  suggestions.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        // mousedown, ne click: blur pole by seznam zavřel dřív
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setQuery('');
                          setSearchOpen(false);
                          reveal(person.id);
                        }}
                      >
                        {personLabel(person)}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          {rolesPresent.map((role) => (
            <button
              key={role}
              type="button"
              className={`genealogy-lens${lens === role ? ' genealogy-lens-active' : ''}`}
              onClick={() => setLens((prev) => (prev === role ? null : role))}
              aria-pressed={lens === role}
              title={cs.genealogy.lensHint}
            >
              <span className="genealogy-role-dot" style={{ background: ROLE_COLORS[role] }} />
              {cs.genealogy.roles[role]}
            </button>
          ))}

          {foldable.length > 0 ? (
            <button type="button" className="genealogy-lens" onClick={toggleAll}>
              {allExpanded ? cs.genealogy.collapseAll : cs.genealogy.expandAll}
            </button>
          ) : null}

          {canEdit ? (
            <span className="genealogy-progress" title={cs.genealogy.unverifiedNotice}>
              {cs.genealogy.verifiedCount(relationTotals.verified, relationTotals.total)}
            </span>
          ) : null}
        </div>

        <div
          className="genealogy-scroll"
          ref={scrollRef}
          onScroll={remember}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          <div
            className="genealogy-canvas"
            style={{
              width: layout.width + 2 * PAD_X,
              height: layout.height + PAD_TOP + PAD_BOTTOM,
            }}
          >
            <svg
              className="genealogy-edges"
              width={layout.width + 2 * PAD_X}
              height={layout.height + PAD_TOP + PAD_BOTTOM}
              aria-hidden="true"
            >
              {layout.nodes.map((node) => {
                const parent = node.parentId ? nodeMap.get(node.parentId) : null;
                if (!parent || !node.relation) return null;
                const x1 = parent.x + PAD_X + NODE_WIDTH / 2;
                const y1 = parent.y + PAD_TOP + NODE_HEIGHT;
                const x2 = node.x + PAD_X + NODE_WIDTH / 2;
                const y2 = node.y + PAD_TOP;
                const mid = (y1 + y2) / 2;
                return (
                  <path
                    key={node.id}
                    className={edgeClass(node.relation)}
                    d={x1 === x2 ? `M${x1},${y1}V${y2}` : `M${x1},${y1}V${mid}H${x2}V${y2}`}
                  />
                );
              })}
            </svg>

            {layout.nodes.map((node) => {
              const person = kin.persons.get(node.id);
              if (!person) return null;
              return (
                <PersonCard
                  key={node.id}
                  node={node}
                  person={person}
                  events={eventsByPerson.get(node.id)}
                  disputed={(kin.parents.get(node.id) ?? []).some((r) => r.certainty === 'sporne')}
                  selected={node.id === selectedId}
                  dimmed={lens !== null && !person.roles.includes(lens)}
                  onSelect={() => setSelectedId(node.id)}
                  onToggle={() => toggleBranch(node)}
                />
              );
            })}
          </div>
        </div>

        <ul className="genealogy-legend" aria-hidden="true">
          <li>
            <span className="genealogy-legend-line" /> {cs.genealogy.legendStated}
          </li>
          <li>
            <span className="genealogy-legend-line genealogy-legend-derived" /> {cs.genealogy.legendDerived}
            {' / '}
            {cs.genealogy.legendFoster}
          </li>
          <li>
            <span className="genealogy-legend-line genealogy-legend-disputed" /> {cs.genealogy.legendDisputed}
          </li>
        </ul>
      </div>

      {selected ? (
        <PersonPanel
          key={selected.id}
          person={selected}
          kin={kin}
          events={eventsByPerson.get(selected.id) ?? []}
          inTree={nodeMap.has(selected.id) || expansionsToReveal(kin, selected.id) !== null}
          canEdit={canEdit}
          onPick={reveal}
          onShowOnTimeline={onShowOnTimeline}
          onSaveRelation={onSaveRelation}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

/** Kde na obrazovce leží karta osoby; `null`, když ve stromu zrovna není. */
function screenPosition(container: HTMLElement, personId: string): { left: number; top: number } | null {
  const card = container.querySelector(`[data-person="${personId}"]`);
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  return { left: rect.left, top: rect.top };
}

function edgeClass(relation: Relation): string {
  const style =
    relation.certainty === 'sporne'
      ? ' genealogy-edge-disputed'
      : relation.certainty === 'odvozeno' || relation.kind !== 'rodic'
        ? ' genealogy-edge-derived'
        : '';
  return `genealogy-edge${style}${relation.verified ? ' genealogy-edge-verified' : ''}`;
}

// ---------------------------------------------------------------------------
// Karta osoby
// ---------------------------------------------------------------------------

interface CardProps {
  node: TreeNode;
  person: Person;
  events: PersonEvent[] | undefined;
  disputed: boolean;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

function PersonCard({ node, person, events, disputed, selected, dimmed, onSelect, onToggle }: CardProps) {
  const life = events?.find((entry) => entry.role === 'zivot') ?? events?.[0];
  const sub = life ? formatRangeCompact(life.event.start, life.event.end) : person.qualifier;
  const roles = person.roles.filter(isRole);
  const className =
    'genealogy-card' +
    (person.spine ? ' genealogy-card-spine' : '') +
    (selected ? ' genealogy-card-selected' : '') +
    (dimmed ? ' genealogy-card-dimmed' : '');

  return (
    <div
      className="genealogy-node"
      data-person={node.id}
      style={{ left: node.x + PAD_X, top: node.y + PAD_TOP, width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      <button type="button" className={className} onClick={onSelect} aria-pressed={selected}>
        <span className="genealogy-card-name">
          {person.name}
          {disputed ? (
            <span className="genealogy-card-mark" title={cs.genealogy.disputed}>
              ?
            </span>
          ) : null}
        </span>
        {sub ? <span className="genealogy-card-sub">{sub}</span> : null}
        {roles.length > 0 ? (
          <span className="genealogy-card-roles">
            {roles.map((role) => (
              <span
                key={role}
                className="genealogy-role-dot"
                style={{ background: ROLE_COLORS[role] }}
                title={cs.genealogy.roleOne[role]}
              />
            ))}
          </span>
        ) : null}
      </button>
      {node.foldable ? (
        <button
          type="button"
          className={`genealogy-fold${node.expanded ? ' genealogy-fold-open' : ''}`}
          onClick={onToggle}
          aria-expanded={node.expanded}
          aria-label={node.expanded ? cs.genealogy.collapseBranch : cs.genealogy.expandBranch(node.hidden)}
          title={node.expanded ? cs.genealogy.collapseBranch : cs.genealogy.expandBranch(node.hidden)}
        >
          {node.expanded ? '−' : `+${node.hidden}`}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel osoby
// ---------------------------------------------------------------------------

interface PanelProps {
  person: Person;
  kin: KinIndex;
  events: PersonEvent[];
  inTree: boolean;
  canEdit: boolean;
  onPick: (personId: string) => void;
  onShowOnTimeline: (event: TimelineEvent) => void;
  onSaveRelation: (id: string, patch: RelationPatch) => Promise<Relation>;
  onClose: () => void;
}

function PersonPanel({
  person,
  kin,
  events,
  inTree,
  canEdit,
  onPick,
  onShowOnTimeline,
  onSaveRelation,
  onClose,
}: PanelProps) {
  const relatives = useMemo(() => relativesOf(kin, person.id), [kin, person.id]);
  const roles = person.roles.filter(isRole);

  const parentLabel = (relation: Relation) => {
    if (relation.kind !== 'rodic') return cs.genealogy.kinds[relation.kind];
    const gender = kin.persons.get(relation.fromPerson)?.gender;
    return gender === 'm' ? cs.genealogy.father : gender === 'f' ? cs.genealogy.mother : cs.genealogy.parent;
  };

  const row = (relation: Relation, otherId: string, label: string | null) => {
    const other = kin.persons.get(otherId);
    if (!other) return null;
    return (
      <RelationRow
        key={relation.id}
        relation={relation}
        other={other}
        label={label}
        canEdit={canEdit}
        onPick={onPick}
        onSave={onSaveRelation}
      />
    );
  };

  return (
    <aside className="genealogy-panel" aria-label={cs.genealogy.panelTitle}>
      <header className="genealogy-panel-header">
        <div>
          <h2>{person.name}</h2>
          {person.qualifier ? <p className="genealogy-panel-sub">{person.qualifier}</p> : null}
        </div>
        <button type="button" className="popover-close" onClick={onClose} aria-label={cs.a11y.closePanel}>
          ×
        </button>
      </header>

      {roles.length > 0 || person.altNames.length > 0 ? (
        <p className="genealogy-panel-meta">
          {roles.map((role) => (
            <span key={role} className="genealogy-panel-role">
              <span className="genealogy-role-dot" style={{ background: ROLE_COLORS[role] }} />
              {cs.genealogy.roleOne[role]}
            </span>
          ))}
          {person.altNames.length > 0 ? (
            <span>
              {cs.genealogy.altNames}: {person.altNames.join(', ')}
            </span>
          ) : null}
        </p>
      ) : null}

      {person.note ? (
        <p className="genealogy-panel-note">
          <RichText text={person.note} />
        </p>
      ) : null}

      {!inTree ? <p className="genealogy-panel-hint">{cs.genealogy.notInTree}</p> : null}

      <section className="genealogy-panel-section">
        <h3>{cs.genealogy.onTimeline}</h3>
        {events.length === 0 ? (
          <p className="genealogy-panel-hint">{cs.genealogy.notOnTimeline}</p>
        ) : (
          <ul className="genealogy-events">
            {events.map(({ event, role }) => (
              <li key={event.id}>
                <div>
                  <span className="genealogy-event-name">{event.name}</span>
                  <span className="genealogy-event-when">
                    {cs.genealogy.eventRoles[role]} · {formatRange(event.start, event.end)}
                  </span>
                </div>
                <button type="button" className="genealogy-link" onClick={() => onShowOnTimeline(event)}>
                  {cs.genealogy.showOnTimeline}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {relatives.parents.length > 0 ? (
        <section className="genealogy-panel-section">
          <h3>{cs.genealogy.parents}</h3>
          <ul className="genealogy-relations">
            {relatives.parents.map((relation) => row(relation, relation.fromPerson, parentLabel(relation)))}
          </ul>
        </section>
      ) : null}

      {relatives.spouses.length > 0 ? (
        <section className="genealogy-panel-section">
          <h3>{cs.genealogy.spouses}</h3>
          <ul className="genealogy-relations">
            {relatives.spouses.map(({ relation, personId }) => row(relation, personId, null))}
          </ul>
        </section>
      ) : null}

      {relatives.children.length > 0 ? (
        <section className="genealogy-panel-section">
          <h3>{cs.genealogy.children}</h3>
          <ul className="genealogy-relations">
            {relatives.children.map((relation) =>
              row(relation, relation.toPerson, relation.kind === 'rodic' ? null : cs.genealogy.kinds[relation.kind]),
            )}
          </ul>
        </section>
      ) : null}

      {relatives.siblings.length > 0 ? (
        <section className="genealogy-panel-section">
          <h3>{cs.genealogy.siblings}</h3>
          <div className="genealogy-chips">
            {relatives.siblings.map((id) => {
              const sibling = kin.persons.get(id);
              return sibling ? (
                <button key={id} type="button" className="genealogy-chip" onClick={() => onPick(id)}>
                  {sibling.name}
                </button>
              ) : null;
            })}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Jedna vazba v panelu
// ---------------------------------------------------------------------------

interface RowProps {
  relation: Relation;
  other: Person;
  label: string | null;
  canEdit: boolean;
  onPick: (personId: string) => void;
  onSave: (id: string, patch: RelationPatch) => Promise<Relation>;
}

const CERTAINTIES: readonly RelationCertainty[] = ['vyslovne', 'odvozeno', 'sporne'];

function RelationRow({ relation, other, label, canEdit, onPick, onSave }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RelationPatch>(() => patchOf(relation));

  const save = async (patch: RelationPatch) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(relation.id, patch);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : cs.genealogy.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="genealogy-relation">
      <div className="genealogy-relation-head">
        <button type="button" className="genealogy-chip" onClick={() => onPick(other.id)}>
          {personLabel(other)}
        </button>
        {label ? <span className="genealogy-relation-label">{label}</span> : null}
        {relation.certainty !== 'vyslovne' ? (
          <span className="genealogy-badge genealogy-badge-warn">{cs.genealogy.certainty[relation.certainty]}</span>
        ) : null}
        {canEdit ? (
          <span className="genealogy-relation-tools">
            <button
              type="button"
              className={`genealogy-tool${relation.verified ? ' genealogy-tool-on' : ''}`}
              disabled={busy}
              onClick={() => void save({ ...patchOf(relation), verified: !relation.verified })}
              aria-pressed={relation.verified}
              aria-label={relation.verified ? cs.genealogy.unverify : cs.genealogy.verify}
              title={relation.verified ? cs.genealogy.unverify : cs.genealogy.verify}
            >
              ✓
            </button>
            <button
              type="button"
              className="genealogy-tool"
              onClick={() => {
                setDraft(patchOf(relation));
                setEditing((prev) => !prev);
              }}
              aria-expanded={editing}
              aria-label={cs.genealogy.editRelation}
              title={cs.genealogy.editRelation}
            >
              ✎
            </button>
          </span>
        ) : null}
      </div>

      {relation.source ? (
        <p className="genealogy-relation-source">
          <RichText text={relation.source} />
        </p>
      ) : canEdit ? (
        <p className="genealogy-relation-source genealogy-relation-missing">{cs.genealogy.noSource}</p>
      ) : null}
      {relation.note ? (
        <p className="genealogy-relation-note">
          <RichText text={relation.note} />
        </p>
      ) : null}
      {error ? <p className="genealogy-relation-error">{error}</p> : null}

      {editing ? (
        <form
          className="genealogy-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(draft);
          }}
        >
          <label>
            {cs.genealogy.formSource}
            <input
              className="input"
              value={draft.source ?? ''}
              onChange={(e) => setDraft({ ...draft, source: e.target.value === '' ? null : e.target.value })}
            />
          </label>
          <label>
            {cs.genealogy.formCertainty}
            <select
              className="input"
              value={draft.certainty}
              onChange={(e) => setDraft({ ...draft, certainty: e.target.value as RelationCertainty })}
            >
              {CERTAINTIES.map((value) => (
                <option key={value} value={value}>
                  {cs.genealogy.certainty[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {cs.genealogy.formNote}
            <textarea
              className="input"
              rows={2}
              value={draft.note ?? ''}
              onChange={(e) => setDraft({ ...draft, note: e.target.value === '' ? null : e.target.value })}
            />
          </label>
          <label className="genealogy-form-check">
            <input
              type="checkbox"
              checked={draft.verified}
              onChange={(e) => setDraft({ ...draft, verified: e.target.checked })}
            />
            {cs.genealogy.formVerified}
          </label>
          <p className="field-hint">{cs.form.linkHint}</p>
          <div className="genealogy-form-actions">
            <button type="submit" className="pill pill-dark" disabled={busy}>
              {busy ? cs.app.saving : cs.app.save}
            </button>
            <button type="button" className="pill" onClick={() => setEditing(false)}>
              {cs.app.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function patchOf(relation: Relation): RelationPatch {
  return {
    certainty: relation.certainty,
    source: relation.source,
    note: relation.note,
    verified: relation.verified,
  };
}
