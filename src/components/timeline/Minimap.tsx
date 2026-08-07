/**
 * Plovoucí minimapa: dráha rozdělená barvami období, v ní proužky záznamů
 * a rám aktuálního výřezu. Tažením se osa posouvá, kliknutím skočí.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cs } from '../../i18n/cs';
import { clampViewport, tOf, viewEnd, type Domain, type Viewport } from '../../lib/viewport';
import type { Category, TimelineEvent } from '../../data/types';
import { categoryColor, eventExtent } from './layout';
import { renderMinimap, THEME, type PeriodSpan } from './renderer';

const MINIMAP_HEIGHT = 36;

interface Props {
  events: TimelineEvent[];
  categoryMap: Map<string, Category>;
  periods: PeriodSpan[];
  view: Viewport;
  domain: Domain;
  onViewChange: (view: Viewport) => void;
}

export function Minimap({ events, categoryMap, periods, view, domain, onViewChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const dragging = useRef<{ grabOffset: number } | null>(null);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.max(entries[0].contentRect.width, 1)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const marks = useMemo(
    () =>
      events.map((event) => {
        const extent = eventExtent(event);
        return { from: extent.from, to: extent.to, color: categoryColor(event.categoryId, categoryMap) };
      }),
    [events, categoryMap],
  );

  const viewFrom = tOf(view, 0);
  const viewTo = viewEnd(view);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(MINIMAP_HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderMinimap({
      ctx,
      width,
      height: MINIMAP_HEIGHT,
      domainMin: domain.min,
      domainMax: domain.max,
      viewFrom,
      viewTo,
      periods,
      marks,
      theme: THEME,
    });
  }, [width, domain, viewFrom, viewTo, marks, periods]);

  const span = Math.max(domain.max - domain.min, 1);
  const tAt = (x: number) => domain.min + (x / Math.max(width, 1)) * span;

  const moveWindowTo = (centerT: number) => {
    const visibleYears = view.width / view.pxPerYear;
    onViewChange(clampViewport({ ...view, t0: centerT - visibleYears / 2 }, domain));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const t = tAt(event.clientX - rect.left);
    event.currentTarget.setPointerCapture(event.pointerId);
    const inside = t >= viewFrom && t <= viewTo;
    dragging.current = { grabOffset: inside ? t - (viewFrom + viewTo) / 2 : 0 };
    if (!inside) moveWindowTo(t);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    moveWindowTo(tAt(event.clientX - rect.left) - dragging.current.grabOffset);
  };

  const endDrag = () => {
    dragging.current = null;
  };

  return (
    <div className="minimap" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className="minimap-canvas"
        style={{ width: '100%', height: `${MINIMAP_HEIGHT}px`, touchAction: 'none' }}
        aria-label={cs.a11y.minimapCanvas}
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  );
}
