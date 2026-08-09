/**
 * Hlavní pohled: čipy pásem, plátno osy a plovoucí minimapa.
 * Nástrojová lišta tu není — gesta ji nahradila.
 *
 * Čipy filtrují po pásmech (velmoci, události, životy, vlády), ne po
 * kategoriích — kategorie zůstávají obdobími, která barví osu a záznamy.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cs } from '../i18n/cs';
import {
  clampViewport,
  DEFAULT_DOMAIN,
  tOf,
  viewEnd,
  viewportForRange,
  type Domain,
  type Viewport,
} from '../lib/viewport';
import type { Category, TimelineEvent } from '../data/types';
import { BANDS, bandOf, eventExtent } from './timeline/layout';
import { Minimap } from './timeline/Minimap';
import type { PeriodSpan } from './timeline/renderer';
import { TimelineCanvas, type FocusRequest } from './timeline/TimelineCanvas';

export interface ExternalFocus {
  event: TimelineEvent;
  nonce: number;
}

export interface SelectionAnchor {
  x: number;
  y: number;
}

interface Props {
  events: TimelineEvent[];
  categories: Category[];
  categoryMap: Map<string, Category>;
  selectedId: string | null;
  onSelect: (event: TimelineEvent | null, anchor: SelectionAnchor | null) => void;
  externalFocus: ExternalFocus | null;
  /** hlásí viditelný rozsah, aby ho hlavička mohla pojmenovat */
  onRangeChange: (from: number, to: number) => void;
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

/** Kategorie s vyplněným rozsahem se chovají jako období a barví osu. */
export function periodsOf(categories: Category[]): PeriodSpan[] {
  return categories
    .filter((c): c is Category & { fromYear: number; toYear: number } =>
      c.fromYear !== null && c.toYear !== null)
    .map((c) => ({ from: c.fromYear, to: c.toYear, color: c.color }))
    .sort((a, b) => a.from - b.from);
}

export function TimelineView({
  events,
  categories,
  categoryMap,
  selectedId,
  onSelect,
  externalFocus,
  onRangeChange,
}: Props) {
  const [hiddenBands, setHiddenBands] = useState<Set<string>>(new Set());
  const [view, setView] = useState<Viewport>({ t0: DEFAULT_DOMAIN.min, pxPerYear: 0.2, width: 0 });
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const nonce = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const domain = useMemo(() => domainOf(events), [events]);
  const periods = useMemo(() => periodsOf(categories), [categories]);

  const visibleEvents = useMemo(
    () => events.filter((event) => !hiddenBands.has(bandOf(event).id)),
    [events, hiddenBands],
  );

  /** Pásma, která vůbec mají záznam – prázdná se v legendě neukazují. */
  const populatedBands = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) set.add(bandOf(event).id);
    return set;
  }, [events]);

  /** Která pásma mají záznam ve výřezu – ostatní se v čipech ztlumí. */
  const inViewport = useMemo(() => {
    const from = tOf(view, 0);
    const to = viewEnd(view);
    const set = new Set<string>();
    for (const event of events) {
      const extent = eventExtent(event);
      if (extent.to >= from && extent.from <= to) set.add(bandOf(event).id);
    }
    return set;
  }, [events, view]);

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

  useEffect(() => {
    if (initialized.current || events.length === 0 || view.width === 0) return;
    initialized.current = true;
    setView((prev) =>
      clampViewport({ ...prev, t0: domain.min, pxPerYear: prev.width / (domain.max - domain.min) }, domain),
    );
  }, [events.length, domain, view.width]);

  useEffect(() => {
    if (view.width > 0) onRangeChange(tOf(view, 0), viewEnd(view));
  }, [view, onRangeChange]);

  const lastNonce = useRef(-1);
  useEffect(() => {
    if (!externalFocus || externalFocus.nonce === lastNonce.current) return;
    lastNonce.current = externalFocus.nonce;
    const extent = eventExtent(externalFocus.event);
    if (view.width > 0) {
      const isPoint = extent.from === extent.to;
      setView(
        viewportForRange(
          isPoint ? extent.from - 25 : extent.from,
          isPoint ? extent.to + 25 : extent.to,
          view.width,
          domain,
        ),
      );
    }
    nonce.current += 1;
    setFocusRequest({ id: externalFocus.event.id, nonce: nonce.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFocus]);

  const toggleBand = (id: string) => {
    setHiddenBands((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleBands = BANDS.filter((band) => populatedBands.has(band.id));

  return (
    <div className="timeline-view">
      {visibleBands.length > 1 ? (
        <div className="chips" role="group" aria-label={cs.timeline.legend}>
          {visibleBands.map((band) => {
            const hidden = hiddenBands.has(band.id);
            const dimmed = !inViewport.has(band.id);
            return (
              <button
                key={band.id}
                type="button"
                className={`chip${hidden ? ' chip-off' : ''}${dimmed ? ' chip-dim' : ''}`}
                onClick={() => toggleBand(band.id)}
                aria-pressed={!hidden}
              >
                {cs.timeline.bands[band.id as keyof typeof cs.timeline.bands] ?? band.id}
              </button>
            );
          })}
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
          periods={periods}
          selectedId={selectedId}
          onSelect={onSelect}
          focusRequest={focusRequest}
          hiddenBands={hiddenBands}
        />
        <Minimap
          events={visibleEvents}
          categoryMap={categoryMap}
          periods={periods}
          view={view}
          domain={domain}
          onViewChange={setView}
        />
      </div>
    </div>
  );
}
