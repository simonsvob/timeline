/**
 * Kostra aplikace: přepínání pohledů (osa / tabulka), přihlášení,
 * modály (formulář, data) a detail vybraného záznamu.
 *
 * Filtr pásem drží stav tady, protože jeho tlačítko sedí v hlavičce, ale
 * filtruje se obsah osy. Správa štítků i období bydlí v modálu Data —
 * sahá se na ně zřídka a v hlavičce by jen ubíraly místo.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { cs } from './i18n/cs';
import { useAppState } from './state/store';
import { AuthPanel } from './components/AuthPanel';
import { BandFilter } from './components/BandFilter';
import { DataPanel } from './components/DataPanel';
import { DetailPanel } from './components/DetailPanel';
import { EventForm } from './components/EventForm';
import { SearchBox, LockButton } from './components/SearchBox';
import { TableView } from './components/TableView';
import { TimelineView, type ExternalFocus, type SelectionAnchor } from './components/TimelineView';
import { formatYear } from './lib/format';
import { ConfirmDialog, Spinner } from './components/ui';
import type { EventDraft, Placement, TimelineEvent } from './data/types';

type ViewMode = 'timeline' | 'table';
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
  const [pendingDelete, setPendingDelete] = useState<TimelineEvent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hiddenBands, setHiddenBands] = useState<Set<Placement>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  const selected = useMemo(
    () => state.events.find((event) => event.id === selectedId) ?? null,
    [state.events, selectedId],
  );

  /** Ukázat záznam na ose – z hledání i z tabulky. */
  const showOnTimeline = useCallback((event: TimelineEvent) => {
    focusNonce.current += 1;
    setTimelineFocus({ event, nonce: focusNonce.current });
    setSelectedId(event.id);
    setAnchor(null);
    setMode('timeline');
  }, []);

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

        <nav className="switch" aria-label={cs.nav.timeline}>
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
        </nav>

        <div className="app-actions">
          <SearchBox events={state.events} tagMap={state.tagMap} onPick={showOnTimeline} />
          {state.canEdit ? (
            <button type="button" className="pill pill-dark" onClick={openNew}>
              {cs.table.newEvent}
            </button>
          ) : null}
          {mode === 'timeline' && populatedBands.size > 1 ? (
            <div className="filter-anchor">
              <button
                type="button"
                className={`pill${hiddenBands.size > 0 ? ' pill-active' : ''}`}
                onClick={() => setFilterOpen((prev) => !prev)}
                aria-expanded={filterOpen}
              >
                {cs.nav.filter}
                {hiddenBands.size > 0
                  ? ` (${populatedBands.size - hiddenBands.size}/${populatedBands.size})`
                  : ''}
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
          <button type="button" className="pill" onClick={() => setModal('data')}>
            {cs.nav.data}
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
                  onRangeChange={onRangeChange}
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

            {selected ? (
              <DetailPanel
                event={selected}
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
