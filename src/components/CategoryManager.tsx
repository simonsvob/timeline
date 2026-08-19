/**
 * Správa období: vytvoření, přejmenování, barva (paleta i vlastní hex),
 * pořadí a smazání.
 *
 * Období barví centrální čáru a dráhu minimapy podle toho, KDY se něco stalo.
 * Barvu jednotlivých záznamů neurčují – tu nese štítek (viz TagManager).
 * Vazba na záznamy proto neexistuje a smazání období se jich nedotkne.
 */

import { useState } from 'react';
import { cs } from '../i18n/cs';
import { formatYear } from '../lib/format';
import { isValidHexColor, validateCategoryForm } from '../lib/validation';
import type { Category, CategoryDraft } from '../data/types';
import { ConfirmDialog, Modal } from './ui';
import { COLOR_PALETTE, ColorPicker } from './ColorPicker';

interface Props {
  categories: Category[];
  canEdit: boolean;
  onSave: (id: string | null, draft: CategoryDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (ordered: Category[]) => Promise<void>;
  onClose: () => void;
}

export function CategoryManager({
  categories,
  canEdit,
  onSave,
  onDelete,
  onReorder,
  onClose,
}: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const handleAdd = async () => {
    const problems = validateCategoryForm(newName, newColor);
    if (Object.keys(problems).length > 0) {
      setError(problems.name ?? problems.color ?? null);
      return;
    }
    setError(null);
    try {
      await onSave(null, {
        name: newName.trim(),
        color: newColor,
        sortOrder: categories.length,
        fromYear: null,
        toYear: null,
      });
      setNewName('');
      setNewColor(COLOR_PALETTE[(categories.length + 1) % COLOR_PALETTE.length]);
    } catch (err) {
      setError(err instanceof Error ? err.message : cs.categories.saveError);
    }
  };

  const handleUpdate = async (category: Category, changes: Partial<CategoryDraft>) => {
    const draft: CategoryDraft = {
      name: changes.name ?? category.name,
      color: changes.color ?? category.color,
      sortOrder: changes.sortOrder ?? category.sortOrder,
      fromYear: changes.fromYear !== undefined ? changes.fromYear : category.fromYear,
      toYear: changes.toYear !== undefined ? changes.toYear : category.toYear,
    };
    if (draft.name.trim() === '' || !isValidHexColor(draft.color)) return;
    try {
      await onSave(category.id, { ...draft, name: draft.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : cs.categories.saveError);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    await onReorder(next);
  };

  return (
    <>
      <Modal
        title={cs.categories.title}
        onClose={onClose}
        wide
        footer={
          <button type="button" className="button" onClick={onClose}>
            {cs.app.close}
          </button>
        }
      >
        <p className="muted manager-intro">{cs.categories.intro}</p>

        {error ? <p className="form-error">{error}</p> : null}

        {categories.length === 0 ? (
          <p className="muted">{cs.categories.empty}</p>
        ) : (
          <ul className="category-list">
            {categories.map((category, index) => (
              <li key={category.id} className="category-row">
                {canEdit ? (
                  <ColorPicker
                    value={category.color}
                    onChange={(color) => void handleUpdate(category, { color })}
                  />
                ) : (
                  <span className="color-swatch" style={{ background: category.color }} />
                )}
                {canEdit ? (
                  <input
                    className="input category-name"
                    defaultValue={category.name}
                    aria-label={cs.categories.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== category.name) {
                        void handleUpdate(category, { name: e.target.value });
                      }
                    }}
                  />
                ) : (
                  <span className="category-name">{category.name}</span>
                )}
                <span className="category-count">
                  {category.fromYear !== null && category.toYear !== null
                    ? cs.categories.span(
                        `${formatYear(category.fromYear)} – ${formatYear(category.toYear)}`,
                      )
                    : cs.categories.spanNone}
                </span>
                <div className="category-actions" hidden={!canEdit}>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={cs.categories.moveUp}
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={cs.categories.moveDown}
                    disabled={index === categories.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-danger"
                    aria-label={cs.app.delete}
                    onClick={() => setPendingDelete(category)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="category-new" hidden={!canEdit}>
          <h3>{cs.categories.newCategory}</h3>
          <div className="category-row">
            <ColorPicker value={newColor} onChange={setNewColor} />
            <input
              className="input category-name"
              value={newName}
              placeholder={cs.categories.name}
              aria-label={cs.categories.name}
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
      </Modal>

      {pendingDelete ? (
        <ConfirmDialog
          title={cs.categories.deleteConfirmTitle}
          body={cs.categories.deleteConfirmBody(pendingDelete.name)}
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

