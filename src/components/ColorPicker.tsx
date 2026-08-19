/**
 * Výběr barvy: paleta plus vlastní hex. Používají ho správa štítků i období,
 * proto sedí zvlášť a ne u jednoho z nich.
 */

import { useState } from 'react';
import { cs } from '../i18n/cs';
import { isValidHexColor } from '../lib/validation';

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

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);

  return (
    <div className="color-picker">
      <button
        type="button"
        className="color-swatch"
        style={{ background: value }}
        aria-label={cs.tags.color}
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
            <span>{cs.tags.customColor}</span>
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
