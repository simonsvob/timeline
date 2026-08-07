/**
 * Hlavní pohled: nenápadná legenda kategorií, plátno osy a minimapa.
 *
 * Nástrojová lišta (skok na rok, tlačítka zoomu, celý rozsah) tu záměrně není:
 * pinch a tažení zvládnou totéž rychleji a lišta jen zabírala místo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cs } from '../i18n/cs';
import {
  clampViewport,
  DEFAULT_DOMAIN,
  viewportForRange,
  type Domain,
  type Viewport,
} from '../lib/viewport';
import type { Category, TimelineEvent } from '../data/types';
import { eventExtent, NO_CATEGORY_COLOR } from './timeline/layout';
import { Minimap } from './timeline/Minimap';
import { TimelineCanvas, type FocusRequest } from './timeline/TimelineCanvas';

export interface ExternalFocus {
  event: TimelineEvent;
  nonce: number;
}

interface Props {
  events: TimelineEvent[];
  categories: Category[];
  categoryMap: Map<string, Category>;
  selectedId: string | null;
  onSelect: (event: TimelineEvent | null) => void;
  /** požadavek z jiného pohledu (tabulka, hledání) – ukázat konkrétní záznam */
  externalFocus: ExternalFocus | null;
}

/** Rozsah osy podle dat, s rezervou; bez dat výchozí ~4200 př. n. l. – 200 n. l. */
export function domainOf(events: TimelineEvent[]): Domain {
  if (events.length === 0) return DEFAULT_DOMAIN;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    const extent = eventExtent(event);
    if (extent.from < min) min = extent.from;
    if (extent.to > max) max = extent.to;
  }
  const padding = Math.max((max - min) * 0.04, 25);
  return { min: Math.floor(min - padding), max: Math.ceil(max + padding) };
}

export function TimelineView({
  events,
  categories,
  categoryMap,
  selectedId,
  onSelect,
  externalFocus,
}: Props) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [view, setView] = useState<Viewport>({ t0: DEFAULT_DOMAIN.min, pxPerYear: 0.2, width: 0 });
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const nonce = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const domain = useMemo(() => domainOf(events), [events]);

  const visibleEvents = useMemo(
    () => events.filter((event) => !hiddenCategories.has(event.categoryId ?? '')),
    [events, hiddenCategories],
  );

  // Šířku plátna hlídá canvas; sem ji propíšeme přes ResizeObserver kontejneru.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.max(entries[0].contentRect.width, 1);
      setView((prev) => {
        if (prev.width === width) return prev;
        if (prev.width === 0) {
          return clampViewport({ t0: domain.min, pxPerYear: width / (domain.max - domain.min), width }, domain);
        }
        const center = prev.t0 + prev.width / prev.pxPerYear / 2;
        return clampViewport({ ...prev, width, t0: center - width / prev.pxPerYear / 2 }, domain);
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [domain]);

  // Po prvním načtení dat ukázat celý rozsah.
  useEffect(() => {
    if (initialized.current || events.length === 0 || view.width === 0) return;
    initialized.current = true;
    setView((prev) =>
      clampViewport({ ...prev, t0: domain.min, pxPerYear: prev.width / (domain.max - domain.min) }, domain),
    );
  }, [events.length, domain, view.width]);

  // Požadavek z hledání nebo z tabulky
  const lastNonce = useRef(-1);
  useEffect(() => {
    if (!externalFocus || externalFocus.nonce === lastNonce.current) return;
    lastNonce.current = externalFocus.nonce;
    const extent = eventExtent(externalFocus.event);
    if (view.width > 0) {
      const isPoint = extent.from === extent.to;
      const from = isPoint ? extent.from - 25 : extent.from;
      const to = isPoint ? extent.to + 25 : extent.to;
      setView(viewportForRange(from, to, view.width, domain));
    }
    nonce.current += 1;
    setFocusRequest({ id: externalFocus.event.id, nonce: nonce.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFocus]);

  const toggleCategory = (id: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="timeline-view">
      {categories.length > 0 ? (
        <div className="legend" role="group" aria-label={cs.timeline.legend}>
          {categories.map((category) => {
            const skryta = hiddenCategories.has(category.id);
            return (
              <button
                key={category.id}
                type="button"
                className={`legend-chip${skryta ? ' legend-chip-off' : ''}`}
                onClick={() => toggleCategory(category.id)}
                aria-pressed={!skryta}
              >
                <span className="legend-swatch" style={{ background: category.color }} />
                {category.name}
              </button>
            );
          })}
          <button
            type="button"
            className={`legend-chip${hiddenCategories.has('') ? ' legend-chip-off' : ''}`}
            onClick={() => toggleCategory('')}
            aria-pressed={!hiddenCategories.has('')}
          >
            <span className="legend-swatch" style={{ background: NO_CATEGORY_COLOR }} />
            {cs.timeline.withoutCategory}
          </button>
        </div>
      ) : null}

      <div className="timeline-body" ref={containerRef}>
        {events.length === 0 ? (
          <div className="timeline-empty">
            <p>{cs.timeline.emptyTitle}</p>
          </div>
        ) : null}
        <TimelineCanvas
          events={visibleEvents}
          categoryMap={categoryMap}
          view={view}
          onViewChange={setView}
          domain={domain}
          selectedId={selectedId}
          onSelect={onSelect}
          focusRequest={focusRequest}
        />
      </div>

      <div className="timeline-footer">
        <Minimap
          events={visibleEvents}
          categoryMap={categoryMap}
          view={view}
          domain={domain}
          onViewChange={setView}
        />
      </div>
    </div>
  );
}
