/**
 * Filtr pásem jako bublina u tlačítka v hlavičce.
 *
 * Nezakrývá osu jako modál a zavře se kliknutím kamkoli jinam — filtruje se
 * málokdy a osa má dostat co nejvíc místa. Filtruje se po pásmech, ne po
 * štítcích: štítek nese barvu, ne polohu.
 */

import { useEffect, useRef } from 'react';
import { cs } from '../i18n/cs';
import { BANDS } from './timeline/layout';
import type { Placement } from '../data/types';

interface Props {
  /** pásma, která mají aspoň jeden záznam – prázdná se nenabízejí */
  populated: Set<Placement>;
  hidden: Set<Placement>;
  onToggle: (id: Placement) => void;
  onShowAll: () => void;
  onClose: () => void;
}

export function BandFilter({ populated, hidden, onToggle, onShowAll, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Zavřít kliknutím mimo i klávesou Escape. `pointerdown` (ne `click`), aby
  // bublina zmizela hned při doteku a nepřekážela gestu na ose pod ní.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const bands = BANDS.filter((band) => populated.has(band.id));

  return (
    <div className="filter-popover" ref={ref} role="group" aria-label={cs.timeline.legend}>
      <p className="filter-hint">{cs.timeline.legendHint}</p>
      <ul className="filter-list">
        {bands.map((band) => {
          const off = hidden.has(band.id);
          return (
            <li key={band.id}>
              <label className="filter-row">
                <input type="checkbox" checked={!off} onChange={() => onToggle(band.id)} />
                <span>{cs.timeline.bands[band.id]}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="link-button filter-all"
        disabled={hidden.size === 0}
        onClick={onShowAll}
      >
        {cs.timeline.legendAll}
      </button>
    </div>
  );
}
