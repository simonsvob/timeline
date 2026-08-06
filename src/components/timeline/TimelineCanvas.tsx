/**
 * Interaktivní plátno časové osy.
 *
 * Ovládání:
 *   - kolečko myši / trackpad = plynulý zoom kolem kurzoru (Shift nebo
 *     vodorovné gesto posouvá),
 *   - tažení = posun (vodorovně i svisle),
 *   - pinch dvěma prsty (iPad) = zoom kolem středu gesta,
 *   - dvojklik = přiblížení, s Alt/Shift oddálení,
 *   - klik/tap na záznam = výběr.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cs } from '../../i18n/cs';
import { generateTicks, panBy, tOf, viewEnd, zoomAt, type Domain, type Viewport } from '../../lib/viewport';
import type { Category, TimelineEvent } from '../../data/types';
import { hitTest, LANE_HEIGHT, layoutEvents, type LayoutResult } from './layout';
import { AXIS_HEIGHT, LIGHT_THEME, renderTimeline } from './renderer';

const LABEL_FONT = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const AXIS_FONT = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
/** Práh v pixelech, do kterého se tažení ještě považuje za klik. */
const CLICK_SLOP = 6;

const measureCache = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;

function measureText(text: string): number {
  const cached = measureCache.get(text);
  if (cached !== undefined) return cached;
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
    if (measureCtx) measureCtx.font = LABEL_FONT;
  }
  const width = measureCtx ? measureCtx.measureText(text).width : text.length * 7;
  measureCache.set(text, width);
  return width;
}

interface Props {
  events: TimelineEvent[];
  categoryMap: Map<string, Category>;
  view: Viewport;
  onViewChange: (view: Viewport) => void;
  domain: Domain;
  selectedId: string | null;
  onSelect: (event: TimelineEvent | null) => void;
  /** nová hodnota (nová identita objektu) vynutí posun na daný záznam */
  focusRequest: FocusRequest | null;
}

/** Požadavek „ukaž tento záznam". `nonce` umožní vyžádat totéž opakovaně. */
export interface FocusRequest {
  id: string;
  nonce: number;
}

export function TimelineCanvas({
  events,
  categoryMap,
  view,
  onViewChange,
  domain,
  selectedId,
  onSelect,
  focusRequest,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ---------------------------------------------------------------------
  // Rozměry
  // ---------------------------------------------------------------------
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const contentHeight = Math.max(size.height - AXIS_HEIGHT, 0);

  const layout: LayoutResult = useMemo(
    () => layoutEvents(events, view, categoryMap, measureText),
    [events, view, categoryMap],
  );

  const maxScroll = Math.max(0, layout.height + LANE_HEIGHT / 2 - contentHeight);
  useEffect(() => {
    setScrollTop((prev) => Math.min(prev, maxScroll));
  }, [maxScroll]);

  const ticks = useMemo(
    () => (view.width > 0 ? generateTicks(view) : []),
    [view],
  );

  // ---------------------------------------------------------------------
  // Vykreslení
  // ---------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssWidth = size.width;
    const cssHeight = size.height;
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = requestAnimationFrame(() => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTimeline({
        ctx,
        view,
        layout,
        ticks,
        contentHeight,
        scrollTop,
        selectedId,
        hoveredId,
        theme: LIGHT_THEME,
        labelFont: LABEL_FONT,
        axisFont: AXIS_FONT,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [size, view, layout, ticks, contentHeight, scrollTop, selectedId, hoveredId]);

  // ---------------------------------------------------------------------
  // Posun na vybraný záznam
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!focusRequest) return;
    const geometry = layout.items.find((item) => item.event.id === focusRequest.id);
    if (!geometry) return;
    const lane = geometry.lane;
    const targetTop = Math.max(0, lane * LANE_HEIGHT - contentHeight / 2 + LANE_HEIGHT / 2);
    setScrollTop(Math.min(targetTop, maxScroll));
    // vodorovně: pokud je záznam mimo výřez, posuneme ho na střed
    const center = (geometry.x1 + geometry.x2) / 2;
    if (center < 0 || center > view.width) {
      onViewChange(panBy(view, view.width / 2 - center, domain));
    }
    // záměrně jen při novém požadavku, ne při každé změně výřezu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  // ---------------------------------------------------------------------
  // Gesta
  // ---------------------------------------------------------------------
  const viewRef = useRef(view);
  viewRef.current = view;
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const scrollRef = useRef(scrollTop);
  scrollRef.current = scrollTop;
  const maxScrollRef = useRef(maxScroll);
  maxScrollRef.current = maxScroll;

  const clampScroll = useCallback((value: number) => {
    return Math.min(Math.max(value, 0), maxScrollRef.current);
  }, []);

  // Kolečko / trackpad – nesmí být passive, jinak nejde zabránit zoomu stránky.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);

      if (!event.ctrlKey && !event.metaKey && (horizontal || event.shiftKey)) {
        const delta = horizontal ? event.deltaX : event.deltaY;
        onViewChange(panBy(viewRef.current, -delta, domainRef.current));
        return;
      }
      // Pinch na trackpadu přichází jako wheel s ctrlKey.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025));
      onViewChange(zoomAt(viewRef.current, x, factor, domainRef.current));
    };

    // Safari na iPadu: potlačit vlastní zoom stránky nad plátnem
    const preventGesture = (event: Event) => event.preventDefault();

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('gesturestart', preventGesture);
    canvas.addEventListener('gesturechange', preventGesture);
    canvas.addEventListener('gestureend', preventGesture);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('gesturestart', preventGesture);
      canvas.removeEventListener('gesturechange', preventGesture);
      canvas.removeEventListener('gestureend', preventGesture);
    };
  }, [onViewChange]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragState = useRef<{ moved: number; lastX: number; lastY: number } | null>(null);
  const pinchState = useRef<{ distance: number; centerX: number } | null>(null);

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    pointers.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchState.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        centerX: (a.x + b.x) / 2,
      };
      dragState.current = null;
    } else if (pointers.current.size === 1) {
      dragState.current = { moved: 0, lastX: point.x, lastY: point.y };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);

    if (!pointers.current.has(event.pointerId)) {
      // pouhé najetí myší – zvýraznění pod kurzorem
      const hit = hitTest(layout, point.x, point.y - AXIS_HEIGHT, scrollRef.current);
      setHoveredId(hit?.event.id ?? null);
      return;
    }

    pointers.current.set(event.pointerId, point);

    if (pointers.current.size >= 2 && pinchState.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const centerX = (a.x + b.x) / 2;
      const previous = pinchState.current;
      if (previous.distance > 0 && distance > 0) {
        const factor = distance / previous.distance;
        let next = zoomAt(viewRef.current, centerX, factor, domainRef.current);
        // posun středu gesta
        next = panBy(next, centerX - previous.centerX, domainRef.current);
        onViewChange(next);
      }
      pinchState.current = { distance, centerX };
      return;
    }

    const drag = dragState.current;
    if (!drag) return;
    const dx = point.x - drag.lastX;
    const dy = point.y - drag.lastY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.lastX = point.x;
    drag.lastY = point.y;
    if (dx !== 0) onViewChange(panBy(viewRef.current, dx, domainRef.current));
    if (dy !== 0) setScrollTop((prev) => clampScroll(prev - dy));
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const wasDragging = pointers.current.size === 1 && dragState.current;
    const point = localPoint(event);
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchState.current = null;

    if (wasDragging && dragState.current && dragState.current.moved < CLICK_SLOP) {
      const hit = hitTest(layout, point.x, point.y - AXIS_HEIGHT, scrollRef.current);
      onSelect(hit ? hit.event : null);
    }
    if (pointers.current.size === 0) dragState.current = null;
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const factor = event.altKey || event.shiftKey ? 0.5 : 2;
    onViewChange(zoomAt(viewRef.current, x, factor, domainRef.current));
  };

  const cursor = hoveredId ? 'pointer' : 'grab';

  return (
    <div className="timeline-canvas-wrapper" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className="timeline-canvas"
        style={{ width: '100%', height: '100%', cursor, touchAction: 'none' }}
        aria-label={cs.a11y.timelineCanvas}
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() => setHoveredId(null)}
        onDoubleClick={onDoubleClick}
      />
      {maxScroll > 0 ? (
        <div className="timeline-scroll-indicator" aria-hidden="true">
          <div
            className="timeline-scroll-thumb"
            style={{
              top: `${(scrollTop / (maxScroll + contentHeight)) * 100}%`,
              height: `${Math.max((contentHeight / (layout.height + LANE_HEIGHT)) * 100, 8)}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Rozsah dat pro minimapu a omezení posunu. */
export function viewRangeOf(view: Viewport): { from: number; to: number } {
  return { from: tOf(view, 0), to: viewEnd(view) };
}
