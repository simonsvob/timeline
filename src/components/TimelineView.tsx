/**
 * Hlavní pohled: nástrojová lišta, legenda kategorií, plátno osy a minimapa.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cs } from '../i18n/cs';
import { formatYear } from '../lib/format';
import { toAstronomicalYear, type Era } from '../lib/time';
import {
  clampViewport,
  DEFAULT_DOMAIN,
  viewportForRange,
  zoomAt,
  type Domain,
  type Viewport,
} from '../lib/viewport';
import type { Category, TimelineEvent } from '../data/types';
import { eventExtent, NO_CATEGORY_COLOR } from './timeline/layout';
import { Minimap } from './timeline/Minimap';
import { TimelineCanvas, type FocusRequest } from './timeline/TimelineCanvas';

interface Props {
  events: TimelineEvent[];
  categories: Category[];
  categoryMap: Map<string, Category>;
  selectedId: string | null;
  onSelect: (event: TimelineEvent | null) => void;
  /** požadavek z jiného pohledu (tabulka) – ukázat konkrétní záznam */
  externalFocus: TimelineEvent | null;
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
  const [query, setQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [goToYearValue, setGoToYearValue] = useState('');
  const [goToEra, setGoToEra] = useState<Era>('bc');
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
          // první měření – ukázat celý rozsah
          return clampViewport({ t0: domain.min, pxPerYear: width / (domain.max - domain.min), width }, domain);
        }
        // zachovat střed při změně velikosti okna
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
    setView((prev) => clampViewport({ ...prev, t0: domain.min, pxPerYear: prev.width / (domain.max - domain.min) }, domain));
  }, [events.length, domain, view.width]);

  const focusOn = (event: TimelineEvent) => {
    const extent = eventExtent(event);
    if (view.width > 0) {
      const isPoint = extent.from === extent.to;
      const from = isPoint ? extent.from - 25 : extent.from;
      const to = isPoint ? extent.to + 25 : extent.to;
      setView(viewportForRange(from, to, view.width, domain));
    }
    nonce.current += 1;
    setFocusRequest({ id: event.id, nonce: nonce.current });
    onSelect(event);
  };

  // Požadavek z tabulky
  const lastExternal = useRef<string | null>(null);
  useEffect(() => {
    if (!externalFocus || externalFocus.id === lastExternal.current) return;
    lastExternal.current = externalFocus.id;
    focusOn(externalFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFocus]);

  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLocaleLowerCase('cs');
    if (trimmed === '') return [];
    return events
      .filter((event) => event.name.toLocaleLowerCase('cs').includes(trimmed))
      .slice(0, 8);
  }, [events, query]);

  const toggleCategory = (id: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allCategoryKeys = useMemo(
    () => [...categories.map((c) => c.id), ''],
    [categories],
  );

  /**
   * Šířka výřezu, nad kterou skok na rok zároveň přiblíží. Bez toho by se při
   * plném oddálení nestalo nic viditelného – celý rozsah je vidět už teď.
   */
  const GOTO_ZOOM_THRESHOLD_YEARS = 400;
  const GOTO_WINDOW_YEARS = 200;

  const handleGoToYear = (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const parsed = Number(goToYearValue.trim());
    if (!Number.isInteger(parsed) || parsed < 1) return;
    const target = toAstronomicalYear(parsed, goToEra);
    const visibleYears = view.width / view.pxPerYear;
    if (visibleYears > GOTO_ZOOM_THRESHOLD_YEARS) {
      setView(
        viewportForRange(target - GOTO_WINDOW_YEARS / 2, target + GOTO_WINDOW_YEARS / 2, view.width, domain, 0),
      );
      return;
    }
    setView(clampViewport({ ...view, t0: target - visibleYears / 2 }, domain));
  };

  const zoomButton = (factor: number) =>
    setView(zoomAt(view, view.width / 2, factor, domain));

  const showAll = () =>
    setView(clampViewport({ ...view, t0: domain.min, pxPerYear: view.width / (domain.max - domain.min) }, domain));

  return (
    <div className="timeline-view">
      <div className="toolbar">
        <div className="toolbar-group toolbar-search">
          <input
            type="search"
            className="input"
            value={query}
            placeholder={cs.timeline.searchPlaceholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 150)}
            aria-label={cs.timeline.searchPlaceholder}
          />
          {suggestionsOpen && query.trim() !== '' ? (
            <ul className="suggestions">
              {suggestions.length === 0 ? (
                <li className="suggestion-empty">{cs.timeline.noSearchResults}</li>
              ) : (
                suggestions.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className="suggestion"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        focusOn(event);
                        setSuggestionsOpen(false);
                      }}
                    >
                      <span
                        className="suggestion-color"
                        style={{
                          background:
                            categoryMap.get(event.categoryId ?? '')?.color ?? NO_CATEGORY_COLOR,
                        }}
                      />
                      <span className="suggestion-name">{event.name}</span>
                      <span className="suggestion-year">{formatYear(event.start.year)}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>

        <form className="toolbar-group" onSubmit={handleGoToYear}>
          <label className="toolbar-label" htmlFor="goto-year">
            {cs.timeline.goToYear}
          </label>
          <input
            id="goto-year"
            className="input input-year"
            type="number"
            min={1}
            inputMode="numeric"
            value={goToYearValue}
            onChange={(e) => setGoToYearValue(e.target.value)}
          />
          <select
            className="input input-era"
            value={goToEra}
            onChange={(e) => setGoToEra(e.target.value as Era)}
            aria-label={cs.form.era}
          >
            <option value="bc">{cs.era.bc}</option>
            <option value="ad">{cs.era.ad}</option>
          </select>
          <button type="submit" className="button">
            {cs.timeline.go}
          </button>
        </form>

        <div className="toolbar-group toolbar-zoom">
          <button type="button" className="button" onClick={() => zoomButton(1 / 1.6)} aria-label={cs.timeline.zoomOut}>
            −
          </button>
          <button type="button" className="button" onClick={() => zoomButton(1.6)} aria-label={cs.timeline.zoomIn}>
            +
          </button>
          <button type="button" className="button" onClick={showAll}>
            {cs.timeline.zoomAll}
          </button>
        </div>
      </div>

      <div className="legend" role="group" aria-label={cs.timeline.legend}>
        <span className="legend-title">{cs.timeline.legend}</span>
        {categories.map((category) => (
          <label key={category.id} className="legend-item">
            <input
              type="checkbox"
              checked={!hiddenCategories.has(category.id)}
              onChange={() => toggleCategory(category.id)}
            />
            <span className="legend-swatch" style={{ background: category.color }} />
            <span>{category.name}</span>
          </label>
        ))}
        <label className="legend-item">
          <input
            type="checkbox"
            checked={!hiddenCategories.has('')}
            onChange={() => toggleCategory('')}
          />
          <span className="legend-swatch" style={{ background: NO_CATEGORY_COLOR }} />
          <span>{cs.timeline.withoutCategory}</span>
        </label>
        <div className="legend-actions">
          <button type="button" className="link-button" onClick={() => setHiddenCategories(new Set())}>
            {cs.timeline.legendShowAll}
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => setHiddenCategories(new Set(allCategoryKeys))}
          >
            {cs.timeline.legendHideAll}
          </button>
        </div>
      </div>

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
        <p className="timeline-status">
          {cs.timeline.recordCount(visibleEvents.length, events.length)} · {cs.timeline.scaleHint}
        </p>
      </div>
    </div>
  );
}
