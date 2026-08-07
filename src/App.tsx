/**
 * Kostra aplikace: přepínání pohledů (osa / tabulka), přihlášení,
 * modály (formulář, kategorie, data) a detail vybraného záznamu.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { cs } from './i18n/cs';
import { useAppState } from './state/store';
import { AuthPanel } from './components/AuthPanel';
import { CategoryManager } from './components/CategoryManager';
import { DataPanel } from './components/DataPanel';
import { DetailPanel } from './components/DetailPanel';
import { EventForm } from './components/EventForm';
import { SearchBox, LockButton } from './components/SearchBox';
import { TableView } from './components/TableView';
import { TimelineView, type ExternalFocus } from './components/TimelineView';
import { ConfirmDialog, Spinner } from './components/ui';
import type { EventDraft, TimelineEvent } from './data/types';

type ViewMode = 'timeline' | 'table';
type ModalKind = 'none' | 'event' | 'categories' | 'data' | 'auth';

export function App() {
  const state = useAppState();
  const [mode, setMode] = useState<ViewMode>('timeline');
  const [modal, setModal] = useState<ModalKind>('none');
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timelineFocus, setTimelineFocus] = useState<ExternalFocus | null>(null);
  const focusNonce = useRef(0);
  const [pendingDelete, setPendingDelete] = useState<TimelineEvent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = useMemo(
    () => state.events.find((event) => event.id === selectedId) ?? null,
    [state.events, selectedId],
  );

  /** Ukázat záznam na ose – z hledání i z tabulky. */
  const showOnTimeline = useCallback((event: TimelineEvent) => {
    focusNonce.current += 1;
    setTimelineFocus({ event, nonce: focusNonce.current });
    setSelectedId(event.id);
    setMode('timeline');
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
        <h1 className="app-title">{cs.app.title}</h1>

        <nav className="view-switch" aria-label={cs.nav.timeline}>
          <button
            type="button"
            className={`segment${mode === 'timeline' ? ' segment-active' : ''}`}
            onClick={() => setMode('timeline')}
            aria-pressed={mode === 'timeline'}
          >
            {cs.nav.timeline}
          </button>
          <button
            type="button"
            className={`segment${mode === 'table' ? ' segment-active' : ''}`}
            onClick={() => setMode('table')}
            aria-pressed={mode === 'table'}
          >
            {cs.nav.table}
          </button>
        </nav>

        <div className="app-actions">
          <SearchBox events={state.events} categoryMap={state.categoryMap} onPick={showOnTimeline} />
          {state.canEdit ? (
            <>
              <button type="button" className="button button-primary" onClick={openNew}>
                {cs.table.newEvent}
              </button>
              <button type="button" className="button" onClick={() => setModal('categories')}>
                {cs.nav.categories}
              </button>
            </>
          ) : null}
          <button type="button" className="button" onClick={() => setModal('data')}>
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
                  categoryMap={state.categoryMap}
                  selectedId={selectedId}
                  onSelect={(event) => setSelectedId(event?.id ?? null)}
                  externalFocus={timelineFocus}
                />
              ) : (
                <TableView
                  events={state.events}
                  categories={state.categories}
                  categoryMap={state.categoryMap}
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
                category={selected.categoryId ? (state.categoryMap.get(selected.categoryId) ?? null) : null}
                canEdit={state.canEdit}
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
          categories={state.categories}
          onSubmit={handleSubmit}
          onClose={() => setModal('none')}
          onManageCategories={() => setModal('categories')}
        />
      ) : null}

      {modal === 'categories' ? (
        <CategoryManager
          categories={state.categories}
          events={state.events}
          onSave={async (id, draft) => {
            await state.saveCategory(id, draft);
          }}
          onDelete={async (id) => {
            await state.removeCategory(id);
          }}
          onReorder={state.reorderCategories}
          onClose={() => setModal('none')}
        />
      ) : null}

      {modal === 'data' ? (
        <DataPanel
          dataset={{ categories: state.categories, events: state.events }}
          canEdit={state.canEdit}
          onImport={state.importDataset}
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
