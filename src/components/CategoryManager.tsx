/**
 * Správa kategorií: vytvoření, přejmenování, barva (paleta i vlastní hex),
 * pořadí a smazání. Smazáním kategorie záznamy nemizí, jen přijdou o kategorii.
 */

import { useState } from 'react';
import { cs } from '../i18n/cs';
import { isValidHexColor, validateCategoryForm } from '../lib/validation';
import type { Category, CategoryDraft, TimelineEvent } from '../data/types';
import { ConfirmDialog, Modal } from './ui';

/** Paleta k chladné neutrální osě – syté, ale ne křiklavé. */
export const COLOR_PALETTE = [
  '#4f46e5',
  '#0d9488',
  '#e11d48',
  '#d97706',
  '#7c3aed',
  '#0284c7',
  '#65a30d',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#9333ea',
  '#475569',
];

interface Props {
  categories: Category[];
  events: TimelineEvent[];
  onSave: (id: string | null, draft: CategoryDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (ordered: Category[]) => Promise<void>;
  onClose: () => void;
}

export function CategoryManager({
  categories,
  events,
  onSave,
  onDelete,
  onReorder,
  onClose,
}: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const countFor = (id: string) => events.filter((event) => event.categoryId === id).length;

  const handleAdd = async () => {
    const problems = validateCategoryForm(newName, newColor);
    if (Object.keys(problems).length > 0) {
      setError(problems.name ?? problems.color ?? null);
      return;
    }
    setError(null);
    try {
      await onSave(null, { name: newName.trim(), color: newColor, sortOrder: categories.length });
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
        {error ? <p className="form-error">{error}</p> : null}

        {categories.length === 0 ? (
          <p className="muted">{cs.categories.empty}</p>
        ) : (
          <ul className="category-list">
            {categories.map((category, index) => (
              <li key={category.id} className="category-row">
                <ColorPicker
                  value={category.color}
                  onChange={(color) => void handleUpdate(category, { color })}
                />
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
                <span className="category-count">{cs.categories.eventCount(countFor(category.id))}</span>
                <div className="category-actions">
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

        <div className="category-new">
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
          body={cs.categories.deleteConfirmBody(pendingDelete.name, countFor(pendingDelete.id))}
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

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);

  return (
    <div className="color-picker">
      <button
        type="button"
        className="color-swatch"
        style={{ background: value }}
        aria-label={cs.categories.color}
        onClick={() => {
          setHex(value);
          setOpen((prev) => !prev);
        }}
      />
      {open ? (
        <div className="color-popover">
          <div className="color-grid">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch${color === value ? ' color-swatch-active' : ''}`}
                style={{ background: color }}
                aria-label={color}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <label className="color-custom">
            <span>{cs.categories.customColor}</span>
            <input
              className="input"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValidHexColor(hex)) {
                  onChange(hex.trim());
                  setOpen(false);
                }
              }}
            />
          </label>
          <div className="color-popover-actions">
            <button type="button" className="button" onClick={() => setOpen(false)}>
              {cs.app.cancel}
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!isValidHexColor(hex)}
              onClick={() => {
                onChange(hex.trim());
                setOpen(false);
              }}
            >
              {cs.app.save}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
