/**
 * Detail záznamu jako plovoucí karta u vybraného záznamu.
 *
 * Data se formátují přesně podle zadané přesnosti, jistoty a otevřenosti –
 * nikdy se nedoplní den ani měsíc, který uživatel nezadal.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cs, formatNumber, plural } from '../i18n/cs';
import { formatRange, rangeLengthYears } from '../lib/format';
import type { Tag, TimelineEvent } from '../data/types';
import { NO_TAG_COLOR } from './timeline/layout';

const CARD_WIDTH = 300;
const MARGIN = 12;

interface Props {
  event: TimelineEvent;
  tag: Tag | null;
  canEdit: boolean;
  anchor: { x: number; y: number } | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DetailPanel({ event, tag, canEdit, anchor, onEdit, onDelete, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const length = rangeLengthYears(event.start, event.end);
  const openEnd = event.end?.qualifier != null;
  const approxLength = event.start.approx || (event.end?.approx ?? false);

  // Karta se drží u záznamu, ale nesmí vylézt z okna.
  useLayoutEffect(() => {
    if (!anchor) {
      setPosition(null);
      return;
    }
    const height = cardRef.current?.offsetHeight ?? 240;
    const left = Math.min(
      Math.max(anchor.x - CARD_WIDTH / 2, MARGIN),
      window.innerWidth - CARD_WIDTH - MARGIN,
    );
    const below = anchor.y + MARGIN;
    const top = below + height > window.innerHeight - MARGIN
      ? Math.max(anchor.y - height - MARGIN, MARGIN)
      : below;
    setPosition({ left, top });
  }, [anchor, event.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const style = position
    ? { left: `${position.left}px`, top: `${position.top}px` }
    : { right: `${MARGIN}px`, bottom: '84px' };

  return (
    <div
      className="popover"
      ref={cardRef}
      style={style}
      role="dialog"
      aria-label={cs.detail.title}
    >
      <header className="popover-header">
        <span className="popover-dot" style={{ background: tag?.color ?? NO_TAG_COLOR }} />
        <h2>{event.name}</h2>
        <button type="button" className="popover-close" onClick={onClose} aria-label={cs.a11y.closePanel}>
          ×
        </button>
      </header>

      <dl className="popover-list">
        <dt>{cs.detail.when}</dt>
        <dd>{formatRange(event.start, event.end)}</dd>

        {length !== null && length >= 1 ? (
          <>
            <dt>{cs.detail.duration}</dt>
            <dd>
              {openEnd ? `${cs.qualifier.atLeast} ` : approxLength ? `${cs.detail.durationApprox} ` : ''}
              {formatNumber(Math.floor(length))} {plural(Math.floor(length), 'rok', 'roky', 'let')}
            </dd>
          </>
        ) : null}

        <dt>{cs.detail.tag}</dt>
        <dd>{tag?.name ?? cs.timeline.withoutTag}</dd>

        <dt>{cs.detail.placement}</dt>
        <dd>{cs.timeline.bands[event.placement]}</dd>

        {event.source ? (
          <>
            <dt>{cs.detail.source}</dt>
            <dd>{event.source}</dd>
          </>
        ) : null}

        {event.placeName || event.lat !== null ? (
          <>
            <dt>{cs.detail.place}</dt>
            <dd>
              {event.placeName ?? ''}
              {event.lat !== null && event.lng !== null ? (
                <span className="popover-muted">
                  {event.placeName ? ' · ' : ''}
                  {event.lat.toFixed(3)}, {event.lng.toFixed(3)}
                </span>
              ) : null}
            </dd>
          </>
        ) : null}

        {event.note ? (
          <>
            <dt>{cs.detail.note}</dt>
            <dd className="popover-note">{event.note}</dd>
          </>
        ) : null}

        {event.keywords.length > 0 ? (
          <>
            <dt>{cs.detail.keywords}</dt>
            <dd className="tag-list">
              {event.keywords.map((keyword) => (
                <span key={keyword} className="tag">
                  {keyword}
                </span>
              ))}
            </dd>
          </>
        ) : null}
      </dl>

      {canEdit ? (
        <div className="popover-actions">
          <button type="button" className="pill pill-dark" onClick={onEdit}>
            {cs.app.edit}
          </button>
          <button type="button" className="pill pill-danger" onClick={onDelete}>
            {cs.app.delete}
          </button>
        </div>
      ) : null}
    </div>
  );
}
