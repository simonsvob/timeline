/**
 * Kostra aplikace: přepínání pohledů (osa / tabulka / rodokmen), přihlášení,
 * modály (formulář, data) a detail vybraného záznamu.
 *
 * Filtr pásem drží stav tady, protože jeho tlačítko sedí v hlavičce, ale
 * filtruje se obsah osy. Správa štítků i období bydlí v modálu Data —
 * sahá se na ně zřídka a v hlavičce by jen ubíraly místo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cs } from './i18n/cs';
import { useAppState } from './state/store';
import { AuthPanel } from './components/AuthPanel';
import { BandFilter } from './components/BandFilter';
import { DataPanel } from './components/DataPanel';
import { DetailPanel } from './components/DetailPanel';
import { EventForm } from './components/EventForm';
import {
  GenealogyView,
  type GenealogyFocus,
  type GenealogyViewState,
} from './components/GenealogyView';
import { FilterIcon, HelpIcon, PlusIcon } from './components/icons';
import { SearchBox, LockButton } from './components/SearchBox';
import { TableView } from './components/TableView';
import {
  TimelineView,
  type ExternalFocus,
  type SelectionAnchor,
  type TimelineViewState,
} from './components/TimelineView';
import { formatYear } from './lib/format';
import { buildKinIndex, treeRoots } from './lib/genealogy';
import { ConfirmDialog, Spinner } from './components/ui';
import type { EventDraft, Placement, TimelineEvent } from './data/types';

type ViewMode = 'timeline' | 'table' | 'genealogy';
type ModalKind = 'none' | 'event' | 'data' | 'auth';

export function App() {
  const state = useAppState();
  const [mode, setMode] = useState<ViewMode>('timeline');
  const [modal, setModal] = useState<ModalKind>('none');
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timelineFocus, setTimelineFocus] = useState<ExternalFocus | null>(null);
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const focusNonce = useRef(0);
  /**
   * Poloha na ose (výřez a svislý posun). Drží ji App, protože přepnutí do
   * tabulky pohled osy odpojí — bez téhle paměti by se návrat pokaždé oddálil
   * na celý rozsah a místo by se muselo hledat znovu. Je to ref, ne stav:
   * mění se při každém snímku posunu a překreslovat kvůli tomu hlavičku
   * nemá smysl.
   */
  const timelineState = useRef<TimelineViewState | null>(null);
  /** Totéž pro rodokmen: rozbalené větve, vybraná osoba a posun. */
  const genealogyState = useRef<GenealogyViewState | null>(null);
  const [genealogyFocus, setGenealogyFocus] = useState<GenealogyFocus | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TimelineEvent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hiddenBands, setHiddenBands] = useState<Set<Placement>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  const selected = useMemo(
    () => state.events.find((event) => event.id === selectedId) ?? null,
    [state.events, selectedId],
  );

  /**
   * Příbuzenství je veřejné celé, i neověřené vazby – zadavatel to tak chce.
   * Ověření slouží jemu: po přihlášení vidí, co už si sám prostudoval.
   */
  const kin = useMemo(
    () =>
      buildKinIndex(state.kinship.persons, state.kinship.relations, {
        includeUnverified: true,
      }),
    [state.kinship],
  );
  /** Rodokmen se nabízí, až je co ukázat. */
  const genealogyAvailable = useMemo(() => treeRoots(kin).length > 0, [kin]);
  const relationTotals = useMemo(
    () => ({
      total: state.kinship.relations.length,
      verified: state.kinship.relations.filter((relation) => relation.verified).length,
    }),
    [state.kinship.relations],
  );

  // Po odhlášení může rodokmen zmizet (nic ověřeného) – zpátky na osu.
  useEffect(() => {
    if (mode === 'genealogy' && !genealogyAvailable && !state.loading) setMode('timeline');
  }, [mode, genealogyAvailable, state.loading]);

  /** Ukázat záznam na ose – z hledání, z tabulky i z rodokmenu. */
  const showOnTimeline = useCallback((event: TimelineEvent) => {
    focusNonce.current += 1;
    setTimelineFocus({ event, nonce: focusNonce.current });
    setSelectedId(event.id);
    setAnchor(null);
    setMode('timeline');
  }, []);

  /** Ukázat osobu v rodokmenu – z detailu záznamu na ose. */
  const showInGenealogy = useCallback((personId: string) => {
    focusNonce.current += 1;
    setGenealogyFocus({ personId, nonce: focusNonce.current });
    setSelectedId(null);
    setMode('genealogy');
  }, []);

  const rememberGenealogy = useCallback((next: GenealogyViewState) => {
    genealogyState.current = next;
  }, []);

  const clearGenealogyFocus = useCallback(() => setGenealogyFocus(null), []);

  const rememberTimeline = useCallback((next: TimelineViewState) => {
    timelineState.current = next;
  }, []);

  /** Skok na záznam je jednorázový; jinak by ho návrat z tabulky zopakoval. */
  const clearFocus = useCallback(() => setTimelineFocus(null), []);

  const onRangeChange = useCallback((from: number, to: number) => {
    setRange((prev) => (prev && prev.from === from && prev.to === to ? prev : { from, to }));
  }, []);

  /** Podtitul hlavičky: rozsah let, který je zrovna vidět. */
  const context = useMemo(
    () =>
      range
        ? `${formatYear(Math.round(range.from))} – ${formatYear(Math.round(range.to))}`
        : '',
    [range],
  );

  /** Pásma, která mají aspoň jeden záznam – prázdná se ve filtru nenabízejí. */
  const populatedBands = useMemo(() => {
    const set = new Set<Placement>();
    for (const event of state.events) set.add(event.placement);
    return set;
  }, [state.events]);

  const filterLabel =
    hiddenBands.size > 0
      ? cs.nav.filterActive(populatedBands.size - hiddenBands.size, populatedBands.size)
      : cs.nav.filter;

  const toggleBand = useCallback((id: Placement) => {
    setHiddenBands((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openNew = useCallback(() => {
    setEditing(null);
    setModal('event');
  }, []);

  const openEdit = useCallback((event: TimelineEvent) => {
    setEditing(event);
    setModal('event');
  }, []);

  const handleSubmit = useCallback(
    async (draft: EventDraft) => {
      const saved = await state.saveEvent(editing?.id ?? null, draft);
      setSelectedId(saved.id);
    },
    [state, editing],
  );

  const handleDelete = useCallback(async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await state.removeEvent(target.id);
      if (selectedId === target.id) setSelectedId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : cs.form.deleteError);
    }
  }, [pendingDelete, state, selectedId]);

  if (!state.configured) {
    return (
      <div className="config-screen">
        <h1>{cs.config.missingTitle}</h1>
        <p>{cs.config.missingBody}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <h1 className="app-title">{cs.app.title}</h1>
          {mode === 'timeline' && context ? <p className="app-context">{context}</p> : null}
        </div>

        <nav
          className={`switch${genealogyAvailable ? ' switch-compact' : ''}`}
          aria-label={cs.nav.views}
        >
          <button
            type="button"
            className={`switch-segment${mode === 'timeline' ? ' switch-segment-active' : ''}`}
            onClick={() => setMode('timeline')}
            aria-pressed={mode === 'timeline'}
          >
            {cs.nav.timeline}
          </button>
          <button
            type="button"
            className={`switch-segment${mode === 'table' ? ' switch-segment-active' : ''}`}
            onClick={() => setMode('table')}
            aria-pressed={mode === 'table'}
          >
            {cs.nav.table}
          </button>
          {genealogyAvailable ? (
            <button
              type="button"
              className={`switch-segment${mode === 'genealogy' ? ' switch-segment-active' : ''}`}
              onClick={() => {
                setSelectedId(null);
                setMode('genealogy');
              }}
              aria-pressed={mode === 'genealogy'}
            >
              {cs.nav.genealogy}
            </button>
          ) : null}
        </nav>
        {/* Na telefonu se tři segmenty nevejdou do řádku; CSS ukáže tuhle nabídku. */}
        {genealogyAvailable ? (
          <select
            className="switch-select"
            value={mode}
            aria-label={cs.nav.views}
            onChange={(e) => {
              const next = e.target.value as ViewMode;
              if (next === 'genealogy') setSelectedId(null);
              setMode(next);
            }}
          >
            <option value="timeline">{cs.nav.timeline}</option>
            <option value="table">{cs.nav.table}</option>
            <option value="genealogy">{cs.nav.genealogy}</option>
          </select>
        ) : null}

        <div className="app-actions">
          <SearchBox events={state.events} tagMap={state.tagMap} onPick={showOnTimeline} />
          {state.canEdit ? (
            <button
              type="button"
              className="pill pill-dark new-record"
              onClick={openNew}
              aria-label={cs.table.newEvent}
              title={cs.table.newEvent}
            >
              <PlusIcon />
              <span className="new-record-label">{cs.table.newEvent}</span>
            </button>
          ) : null}
          {mode === 'timeline' && populatedBands.size > 1 ? (
            <div className="filter-anchor">
              <button
                type="button"
                className={`icon-button${hiddenBands.size > 0 ? ' icon-button-active' : ''}`}
                // Bublina se zavírá pointerdownem kdekoli mimo sebe. Bez tohohle
                // by ji klepnutí na tlačítko zavřelo a hned zase otevřelo.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setFilterOpen((prev) => !prev)}
                aria-expanded={filterOpen}
                aria-label={filterLabel}
                title={filterLabel}
              >
                <FilterIcon />
              </button>
              {filterOpen ? (
                <BandFilter
                  populated={populatedBands}
                  hidden={hiddenBands}
                  onToggle={toggleBand}
                  onShowAll={() => setHiddenBands(new Set())}
                  onClose={() => setFilterOpen(false)}
                />
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="icon-button"
            onClick={() => setModal('data')}
            aria-label={cs.nav.help}
            title={cs.nav.help}
          >
            <HelpIcon />
          </button>
          <LockButton
            unlocked={state.canEdit}
            onClick={() => (state.canEdit ? void state.signOut() : setModal('auth'))}
          />
        </div>
      </header>

      {state.error ? (
        <div className="banner banner-error">
          <span>
            {cs.app.error}: {state.error}
          </span>
          <button type="button" className="button" onClick={() => void state.reload()}>
            {cs.app.retry}
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="banner banner-error">
          <span>{actionError}</span>
          <button type="button" className="button" onClick={() => setActionError(null)}>
            {cs.app.close}
          </button>
        </div>
      ) : null}

      <main className="app-main">
        {state.loading ? (
          <Spinner label={cs.app.loading} />
        ) : (
          <>
            <div className="app-content">
              {mode === 'timeline' ? (
                <TimelineView
                  events={state.events}
                  categories={state.categories}
                  tagMap={state.tagMap}
                  hiddenBands={hiddenBands}
                  selectedId={selectedId}
                  onSelect={(event, at) => {
                    setSelectedId(event?.id ?? null);
                    setAnchor(at);
                  }}
                  externalFocus={timelineFocus}
                  onFocusApplied={clearFocus}
                  saved={timelineState.current}
                  onRemember={rememberTimeline}
                  onRangeChange={onRangeChange}
                />
              ) : mode === 'genealogy' ? (
                <GenealogyView
                  kin={kin}
                  links={state.kinship.links}
                  events={state.events}
                  relationTotals={relationTotals}
                  canEdit={state.canEdit}
                  focus={genealogyFocus}
                  onFocusApplied={clearGenealogyFocus}
                  saved={genealogyState.current}
                  onRemember={rememberGenealogy}
                  onShowOnTimeline={showOnTimeline}
                  onSaveRelation={state.saveRelation}
                />
              ) : (
                <TableView
                  events={state.events}
                  tags={state.tags}
                  tagMap={state.tagMap}
                  canEdit={state.canEdit}
                  onOpen={(event) => (state.canEdit ? openEdit(event) : setSelectedId(event.id))}
                  onCreate={openNew}
                  onShowOnTimeline={showOnTimeline}
                />
              )}
            </div>

            {selected && mode !== 'genealogy' ? (
              <DetailPanel
                event={selected}
                kin={kin}
                links={state.kinship.links}
                onShowInGenealogy={genealogyAvailable ? showInGenealogy : null}
                tag={selected.tagId ? (state.tagMap.get(selected.tagId) ?? null) : null}
                canEdit={state.canEdit}
                anchor={anchor}
                onEdit={() => openEdit(selected)}
                onDelete={() => setPendingDelete(selected)}
                onClose={() => setSelectedId(null)}
              />
            ) : null}
          </>
        )}
      </main>

      {modal === 'event' ? (
        <EventForm
          event={editing}
          tags={state.tags}
          onSubmit={handleSubmit}
          onClose={() => setModal('none')}
        />
      ) : null}

      {modal === 'data' ? (
        <DataPanel
          dataset={{ categories: state.categories, tags: state.tags, events: state.events }}
          canEdit={state.canEdit}
          onImport={state.importDataset}
          onSaveTag={state.saveTag}
          onDeleteTag={state.removeTag}
          onSaveCategory={state.saveCategory}
          onDeleteCategory={state.removeCategory}
          onReorderCategories={state.reorderCategories}
          showGenealogyHelp={genealogyAvailable}
          onClose={() => setModal('none')}
        />
      ) : null}

      {modal === 'auth' ? (
        <AuthPanel onSignIn={state.signIn} onClose={() => setModal('none')} />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={cs.detail.deleteConfirmTitle}
          body={cs.detail.deleteConfirmBody(pendingDelete.name)}
          confirmLabel={cs.app.delete}
          destructive
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  );
}
