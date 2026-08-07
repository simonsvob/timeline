/**
 * Interaktivní plátno časové osy „Řeka".
 *
 * Ovládání:
 *   - pinch dvěma prsty (trackpad Macu i iPad) = plynulý zoom kolem středu gesta,
 *   - dvouprstové posouvání / kolečko = posun vodorovně i svisle,
 *   - tažení = posun,
 *   - dvojklik = přiblížení, s Alt/Shift oddálení,
 *   - klik/tap na záznam = výběr.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cs } from '../../i18n/cs';
import { formatRangeCompact } from '../../lib/format';
import { generateTicks, panBy, zoomAt, type Domain, type Viewport } from '../../lib/viewport';
import type { Category, TimelineEvent } from '../../data/types';
import {
  hitTest,
  layoutEvents,
  PILL_HEIGHT,
  pointLaneY,
  rangeLaneY,
  type LayoutResult,
} from './layout';
import { renderTimeline, THEME, type PeriodSpan } from './renderer';

const NAME_FONT = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const YEAR_FONT = '11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const TICK_FONT = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
/** Práh v pixelech, do kterého se tažení ještě považuje za klik. */
const CLICK_SLOP = 6;
/** Volné místo nad nejvyšší pilulkou a pod nejnižším pruhem. */
const VERTICAL_PADDING = 28;

/**
 * Safari posílá za pinch vlastní GestureEvent, který standardní typy DOM
 * neznají. `scale` je poměr vůči začátku gesta, ne přírůstek.
 */
interface GestureLikeEvent extends Event {
  scale: number;
  clientX: number;
}

const measureCache = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;

function measureText(text: string, weight: 'normal' | 'bold' = 'normal'): number {
  const key = `${weight}|${text}`;
  const cached = measureCache.get(key);
  if (cached !== undefined) return cached;
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  let width = text.length * (weight === 'bold' ? 7.7 : 6.2);
  if (measureCtx) {
    measureCtx.font = weight === 'bold' ? NAME_FONT : YEAR_FONT;
    width = measureCtx.measureText(text).width;
  }
  measureCache.set(key, width);
  return width;
}

/** Roky vedle jména – u bodu jeden údaj, u rozsahu obojí. */
function formatYearsOf(event: TimelineEvent): string {
  return formatRangeCompact(event.start, event.end);
}

export interface FocusRequest {
  id: string;
  nonce: number;
}

interface Props {
  events: TimelineEvent[];
  categoryMap: Map<string, Category>;
  view: Viewport;
  onViewChange: (view: Viewport) => void;
  domain: Domain;
  periods: PeriodSpan[];
  selectedId: string | null;
  onSelect: (event: TimelineEvent | null, anchor: { x: number; y: number } | null) => void;
  focusRequest: FocusRequest | null;
}

export function TimelineCanvas({
  events,
  categoryMap,
  view,
  onViewChange,
  domain,
  periods,
  selectedId,
  onSelect,
  focusRequest,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  /** posun centrální čáry oproti vystředěné poloze */
  const [axisShift, setAxisShift] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  const layout: LayoutResult = useMemo(
    () => layoutEvents(events, view, categoryMap, measureText, formatYearsOf),
    [events, view, categoryMap],
  );

  /**
   * Čára sedí uprostřed volného místa mezi obsahem nad a pod ní. Když se obsah
   * nevejde, dá se s ní svisle posouvat.
   */
  const { axisY, shiftRange } = useMemo(() => {
    const above = layout.heightAbove + VERTICAL_PADDING;
    const below = layout.heightBelow + VERTICAL_PADDING;
    const total = above + below;
    const ideal = size.height >= total ? above + (size.height - total) / 2 : above;
    const min = Math.min(size.height - below, ideal);
    const max = Math.max(above, ideal);
    return { axisY: ideal, shiftRange: { min: min - ideal, max: max - ideal } };
  }, [layout.heightAbove, layout.heightBelow, size.height]);

  const clampShift = useCallback(
    (value: number) => Math.min(Math.max(value, shiftRange.min), shiftRange.max),
    [shiftRange],
  );

  useEffect(() => {
    setAxisShift((prev) => clampShift(prev));
  }, [clampShift]);

  const effectiveAxisY = axisY + axisShift;

  const ticks = useMemo(() => (view.width > 0 ? generateTicks(view, 110) : []), [view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (canvas.width !== Math.round(size.width * dpr) || canvas.height !== Math.round(size.height * dpr)) {
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = requestAnimationFrame(() => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTimeline({
        ctx,
        view,
        layout,
        ticks,
        height: size.height,
        axisY: effectiveAxisY,
        periods,
        selectedId,
        hoveredId,
        theme: THEME,
        nameFont: NAME_FONT,
        yearFont: YEAR_FONT,
        tickFont: TICK_FONT,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [size, view, layout, ticks, effectiveAxisY, periods, selectedId, hoveredId]);

  // posun na vybraný záznam
  useEffect(() => {
    if (!focusRequest) return;
    const geometry = layout.items.find((item) => item.event.id === focusRequest.id);
    if (!geometry) return;
    const center = (geometry.x1 + geometry.x2) / 2;
    if (center < 0 || center > view.width) {
      onViewChange(panBy(view, view.width / 2 - center, domain));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const viewRef = useRef(view);
  viewRef.current = view;
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const axisRef = useRef(effectiveAxisY);
  axisRef.current = effectiveAxisY;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Kolečko / trackpad – nesmí být passive, jinak nejde zabránit zoomu stránky.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;

      // Pinch na trackpadu Macu i Ctrl+kolečko přicházejí jako wheel s ctrlKey.
      if (event.ctrlKey || event.metaKey) {
        onViewChange(zoomAt(viewRef.current, x, Math.exp(-event.deltaY * 0.01), domainRef.current));
        return;
      }
      if (event.deltaX !== 0) {
        onViewChange(panBy(viewRef.current, -event.deltaX, domainRef.current));
      }
      if (event.deltaY !== 0) {
        if (event.shiftKey) onViewChange(panBy(viewRef.current, -event.deltaY, domainRef.current));
        else setAxisShift((prev) => clampShift(prev - event.deltaY));
      }
    };

    // Safari (Mac i iPad) neposílá za pinch na trackpadu wheel s ctrlKey jako
    // Chrome, ale vlastní gesture* události.
    let lastScale = 1;
    const dotykovyPinch = () => pointers.current.size >= 2;

    const onGestureStart = (event: GestureLikeEvent) => {
      event.preventDefault();
      lastScale = event.scale || 1;
    };
    const onGestureChange = (event: GestureLikeEvent) => {
      event.preventDefault();
      if (dotykovyPinch()) return;
      const scale = event.scale || 1;
      if (lastScale <= 0 || scale <= 0) return;
      const rect = canvas.getBoundingClientRect();
      onViewChange(
        zoomAt(viewRef.current, event.clientX - rect.left, scale / lastScale, domainRef.current),
      );
      lastScale = scale;
    };
    const onGestureEnd = (event: GestureLikeEvent) => {
      event.preventDefault();
      lastScale = 1;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('gesturestart', onGestureStart as EventListener);
    canvas.addEventListener('gesturechange', onGestureChange as EventListener);
    canvas.addEventListener('gestureend', onGestureEnd as EventListener);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('gesturestart', onGestureStart as EventListener);
      canvas.removeEventListener('gesturechange', onGestureChange as EventListener);
      canvas.removeEventListener('gestureend', onGestureEnd as EventListener);
    };
  }, [onViewChange, clampShift]);

  const dragState = useRef<{ moved: number; lastX: number; lastY: number } | null>(null);
  const pinchState = useRef<{ distance: number; centerX: number } | null>(null);

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const zasah = (point: { x: number; y: number }) =>
    hitTest(layoutRef.current, point.x, point.y - axisRef.current);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    pointers.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchState.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), centerX: (a.x + b.x) / 2 };
      dragState.current = null;
    } else if (pointers.current.size === 1) {
      dragState.current = { moved: 0, lastX: point.x, lastY: point.y };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);

    if (!pointers.current.has(event.pointerId)) {
      setHoveredId(zasah(point)?.event.id ?? null);
      return;
    }
    pointers.current.set(event.pointerId, point);

    if (pointers.current.size >= 2 && pinchState.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const centerX = (a.x + b.x) / 2;
      const previous = pinchState.current;
      if (previous.distance > 0 && distance > 0) {
        let next = zoomAt(viewRef.current, centerX, distance / previous.distance, domainRef.current);
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
    if (dy !== 0) setAxisShift((prev) => clampShift(prev + dy));
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const wasDragging = pointers.current.size === 1 && dragState.current;
    const point = localPoint(event);
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchState.current = null;

    if (wasDragging && dragState.current && dragState.current.moved < CLICK_SLOP) {
      const hit = zasah(point);
      if (hit) {
        const rect = event.currentTarget.getBoundingClientRect();
        const centerY = hit.isPoint ? pointLaneY(hit.lane) : rangeLaneY(hit.lane);
        const half = (hit.isPoint ? PILL_HEIGHT : 28) / 2;
        onSelect(hit.event, {
          x: rect.left + Math.min(Math.max(hit.centerX, 0), rect.width),
          y: rect.top + axisRef.current + centerY + (hit.isPoint ? -half : half),
        });
      } else {
        onSelect(null, null);
      }
    }
    if (pointers.current.size === 0) dragState.current = null;
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = event.altKey || event.shiftKey ? 0.5 : 2;
    onViewChange(zoomAt(viewRef.current, event.clientX - rect.left, factor, domainRef.current));
  };

  return (
    <div className="timeline-canvas-wrapper" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className="timeline-canvas"
        style={{ width: '100%', height: '100%', cursor: hoveredId ? 'pointer' : 'grab', touchAction: 'none' }}
        aria-label={cs.a11y.timelineCanvas}
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() => setHoveredId(null)}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}
