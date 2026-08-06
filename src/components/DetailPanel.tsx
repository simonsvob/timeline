/**
 * Detail záznamu. Data se formátují přesně podle zadané přesnosti a jistoty –
 * nikdy se nedoplní den ani měsíc, který uživatel nezadal.
 */

import { cs, formatNumber, plural } from '../i18n/cs';
import { formatTimePoint, rangeLengthYears } from '../lib/format';
import type { Category, TimelineEvent } from '../data/types';
import { NO_CATEGORY_COLOR } from './timeline/layout';

interface Props {
  event: TimelineEvent;
  category: Category | null;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DetailPanel({ event, category, canEdit, onEdit, onDelete, onClose }: Props) {
  const length = rangeLengthYears(event.start, event.end);
  const approxLength = event.start.approx || (event.end?.approx ?? false);

  return (
    <aside className="detail-panel" aria-label={cs.detail.title}>
      <header className="detail-header">
        <span
          className="detail-color"
          style={{ background: category?.color ?? NO_CATEGORY_COLOR }}
          aria-hidden="true"
        />
        <h2>{event.name}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={cs.a11y.closePanel}>
          ×
        </button>
      </header>

      <dl className="detail-list">
        <dt>{cs.detail.category}</dt>
        <dd>{category?.name ?? cs.timeline.withoutCategory}</dd>

        <dt>{cs.detail.type}</dt>
        <dd>{event.type === 'range' ? cs.form.typeRange : cs.form.typePoint}</dd>

        <dt>{event.type === 'range' ? cs.detail.start : cs.detail.when}</dt>
        <dd>{formatTimePoint(event.start)}</dd>

        {event.type === 'range' && event.end ? (
          <>
            <dt>{cs.detail.end}</dt>
            <dd>{formatTimePoint(event.end)}</dd>
          </>
        ) : null}

        {length !== null && length >= 1 ? (
          <>
            <dt>{cs.detail.duration}</dt>
            <dd>
              {approxLength ? `${cs.detail.durationApprox} ` : ''}
              {formatNumber(Math.floor(length))} {plural(Math.floor(length), 'rok', 'roky', 'let')}
            </dd>
          </>
        ) : null}

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
                <span className="detail-coords">
                  {event.placeName ? ' · ' : ''}
                  {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
                </span>
              ) : null}
            </dd>
          </>
        ) : null}

        {event.note ? (
          <>
            <dt>{cs.detail.note}</dt>
            <dd className="detail-note">{event.note}</dd>
          </>
        ) : null}

        {event.tags.length > 0 ? (
          <>
            <dt>{cs.detail.tags}</dt>
            <dd className="tag-list">
              {event.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </dd>
          </>
        ) : null}
      </dl>

      {canEdit ? (
        <div className="detail-actions">
          <button type="button" className="button button-primary" onClick={onEdit}>
            {cs.app.edit}
          </button>
          <button type="button" className="button button-danger" onClick={onDelete}>
            {cs.app.delete}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
