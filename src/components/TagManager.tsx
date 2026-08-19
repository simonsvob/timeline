/**
 * Správa štítků: vytvoření, přejmenování, barva a pořadí.
 *
 * Štítek říká, CO záznam je, a jediný určuje jeho barvu na ose. Kam záznam
 * padne, řeší umístění (`placement`) – to je pevný seznam v kódu, protože ke
 * každé hodnotě patří i kus vykreslení. Proto se tu umístění jen vypisují
 * s počty, aby bylo vidět, co která volba ve formuláři znamená.
 *
 * Smazáním štítku záznamy nemizí, jen přijdou o barvu (ON DELETE SET NULL).
 */

import { useState } from 'react';
import { cs } from '../i18n/cs';
import { isValidHexColor, validateCategoryForm } from '../lib/validation';
import { PLACEMENTS, type Tag, type TagDraft, type TimelineEvent } from '../data/types';
import { ConfirmDialog, Modal } from './ui';
import { COLOR_PALETTE, ColorPicker } from './ColorPicker';

interface Props {
  tags: Tag[];
  events: TimelineEvent[];
  canEdit: boolean;
  onSave: (id: string | null, draft: TagDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function TagManager({ tags, events, canEdit, onSave, onDelete, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);

  const countFor = (id: string) => events.filter((event) => event.tagId === id).length;
  const countForPlacement = (placement: string) =>
    events.filter((event) => event.placement === placement).length;

  const handleAdd = async () => {
    const problems = validateCategoryForm(newName, newColor);
    if (Object.keys(problems).length > 0) {
      setError(problems.name ?? problems.color ?? null);
      return;
    }
    setError(null);
    try {
      await onSave(null, { name: newName.trim(), color: newColor, sortOrder: tags.length });
      setNewName('');
      setNewColor(COLOR_PALETTE[(tags.length + 1) % COLOR_PALETTE.length]);
    } catch (err) {
      setError(err instanceof Error ? err.message : cs.tags.saveError);
    }
  };

  const handleUpdate = async (tag: Tag, changes: Partial<TagDraft>) => {
    const draft: TagDraft = {
      name: changes.name ?? tag.name,
      color: changes.color ?? tag.color,
      sortOrder: changes.sortOrder ?? tag.sortOrder,
    };
    if (draft.name.trim() === '' || !isValidHexColor(draft.color)) return;
    try {
      await onSave(tag.id, { ...draft, name: draft.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : cs.tags.saveError);
    }
  };

  /** Přehození dvou sousedů; pořadí se ukládá jako `sortOrder` obou. */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tags.length) return;
    const a = tags[index];
    const b = tags[target];
    await onSave(a.id, { name: a.name, color: a.color, sortOrder: b.sortOrder });
    await onSave(b.id, { name: b.name, color: b.color, sortOrder: a.sortOrder });
  };

  return (
    <>
      <Modal
        title={cs.tags.title}
        onClose={onClose}
        wide
        footer={
          <button type="button" className="button" onClick={onClose}>
            {cs.app.close}
          </button>
        }
      >
        <p className="muted manager-intro">{cs.tags.intro}</p>

        {error ? <p className="form-error">{error}</p> : null}

        {tags.length === 0 ? (
          <p className="muted">{cs.tags.empty}</p>
        ) : (
          <ul className="category-list">
            {tags.map((tag, index) => {
              const count = countFor(tag.id);
              return (
                <li key={tag.id} className="category-row">
                  {canEdit ? (
                    <ColorPicker
                      value={tag.color}
                      onChange={(color) => void handleUpdate(tag, { color })}
                    />
                  ) : (
                    <span className="color-swatch" style={{ background: tag.color }} />
                  )}
                  {canEdit ? (
                    <input
                      className="input category-name"
                      defaultValue={tag.name}
                      aria-label={cs.tags.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== tag.name) {
                          void handleUpdate(tag, { name: e.target.value });
                        }
                      }}
                    />
                  ) : (
                    <span className="category-name">{tag.name}</span>
                  )}
                  <span className="category-count">
                    {count === 0 ? cs.tags.unused : cs.tags.eventCount(count)}
                  </span>
                  {canEdit ? (
                    <div className="category-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={cs.tags.moveUp}
                        disabled={index === 0}
                        onClick={() => void move(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={cs.tags.moveDown}
                        disabled={index === tags.length - 1}
                        onClick={() => void move(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-danger"
                        aria-label={cs.app.delete}
                        onClick={() => setPendingDelete(tag)}
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {canEdit ? (
          <div className="category-new">
            <h3>{cs.tags.newTag}</h3>
            <div className="category-row">
              <ColorPicker value={newColor} onChange={setNewColor} />
              <input
                className="input category-name"
                value={newName}
                placeholder={cs.tags.name}
                aria-label={cs.tags.name}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
              <button type="button" className="button button-primary" onClick={() => void handleAdd()}>
                {cs.app.add}
              </button>
            </div>
          </div>
        ) : null}

        <div className="category-new">
          <h3>{cs.tags.placementsTitle}</h3>
          <p className="muted manager-intro">{cs.tags.placementsIntro}</p>
          <ul className="placement-list">
            {PLACEMENTS.map((placement) => (
              <li key={placement}>
                <span className="placement-name">{cs.timeline.bands[placement]}</span>
                <span className="category-count">
                  {cs.tags.eventCount(countForPlacement(placement))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {pendingDelete ? (
        <ConfirmDialog
          title={cs.tags.deleteConfirmTitle}
          body={cs.tags.deleteConfirmBody(pendingDelete.name, countFor(pendingDelete.id))}
          confirmLabel={cs.app.delete}
          destructive
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            void onDelete(id);
          }}
        />
      ) : null}
    </>
  );
}
