/**
 * Detail záznamu jako plovoucí karta u vybraného záznamu.
 *
 * Data se formátují přesně podle zadané přesnosti, jistoty a otevřenosti –
 * nikdy se nedoplní den ani měsíc, který uživatel nezadal.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cs, formatNumber, plural } from '../i18n/cs';
import { formatRange, rangeLengthYears } from '../lib/format';
import { personLabel, relativesOf, type KinIndex } from '../lib/genealogy';
import type { PersonEventLink, Tag, TimelineEvent } from '../data/types';
import { RichText } from './RichText';
import { NO_TAG_COLOR } from './timeline/layout';

const CARD_WIDTH = 300;
const MARGIN = 12;
/** Kolik jmen dětí se vypíše, než se zbytek shrne do „a 7 dalších“. */
const MAX_FAMILY_NAMES = 6;

interface Props {
  event: TimelineEvent;
  tag: Tag | null;
  canEdit: boolean;
  /** příbuzenství už ořezané podle toho, co smí divák vidět */
  kin: KinIndex;
  links: readonly PersonEventLink[];
  /** `null`, když rodokmen není k dispozici */
  onShowInGenealogy: ((personId: string) => void) | null;
  anchor: { x: number; y: number } | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DetailPanel({
  event,
  tag,
  canEdit,
  kin,
  links,
  onShowInGenealogy,
  anchor,
  onEdit,
  onDelete,
  onClose,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  /**
   * Osoby, ke kterým záznam patří, a jejich nejbližší rodina. Záznam může
   * patřit víc lidem najednou („Daniel, Chananjáš, Mišael, Azarjáš“).
   */
  const family = useMemo(() => {
    const names = (ids: string[]) => {
      const list = ids.map((id) => kin.persons.get(id)?.name).filter((name): name is string => Boolean(name));
      if (list.length <= MAX_FAMILY_NAMES) return list.join(', ');
      return `${list.slice(0, MAX_FAMILY_NAMES).join(', ')} ${cs.genealogy.andMore(list.length - MAX_FAMILY_NAMES)}`;
    };
    return links
      .filter((link) => link.eventId === event.id)
      .map((link) => kin.persons.get(link.personId))
      .filter((person): person is NonNullable<typeof person> => person != null)
      .map((person) => {
        const relatives = relativesOf(kin, person.id);
        return {
          person,
          parents: names(relatives.parents.map((relation) => relation.fromPerson)),
          spouses: names(relatives.spouses.map((spouse) => spouse.personId)),
          children: names(relatives.children.map((relation) => relation.toPerson)),
        };
      })
      .filter((entry) => entry.parents || entry.spouses || entry.children);
  }, [kin, links, event.id]);

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
  }, [anchor, event.id, family.length]);

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

        {event.source ? (
          <>
            <dt>{cs.detail.source}</dt>
            <dd>
              <RichText text={event.source} />
            </dd>
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
            <dd className="popover-note">
              <RichText text={event.note} />
            </dd>
          </>
        ) : null}

        <dt>{cs.detail.tag}</dt>
        <dd>{tag?.name ?? cs.timeline.withoutTag}</dd>
      </dl>

      {family.length > 0 ? (
        <section className="popover-family">
          <h3>{cs.detail.family}</h3>
          {family.map(({ person, parents, spouses, children }) => (
            <div key={person.id} className="popover-family-person">
              {family.length > 1 ? <strong>{personLabel(person)}</strong> : null}
              <dl className="popover-list">
                {parents ? (
                  <>
                    <dt>{cs.genealogy.familyParents}</dt>
                    <dd>{parents}</dd>
                  </>
                ) : null}
                {spouses ? (
                  <>
                    <dt>{cs.genealogy.familySpouses}</dt>
                    <dd>{spouses}</dd>
                  </>
                ) : null}
                {children ? (
                  <>
                    <dt>{cs.genealogy.familyChildren}</dt>
                    <dd>{children}</dd>
                  </>
                ) : null}
              </dl>
              {onShowInGenealogy ? (
                <button type="button" className="genealogy-link" onClick={() => onShowInGenealogy(person.id)}>
                  {cs.genealogy.showInGenealogy}
                </button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

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
