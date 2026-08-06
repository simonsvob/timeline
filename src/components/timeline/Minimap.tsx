/**
 * Minimapa: úzká lišta s přehledem celého rozsahu a vyznačeným výřezem.
 * Tažením výřezu se osa posouvá, kliknutím mimo něj skočí.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cs } from '../../i18n/cs';
import { clampViewport, tOf, viewEnd, type Domain, type Viewport } from '../../lib/viewport';
import type { Category, TimelineEvent } from '../../data/types';
import { categoryColor, eventExtent } from './layout';
import { LIGHT_THEME, renderMinimap } from './renderer';

const MINIMAP_HEIGHT = 46;

interface Props {
  events: TimelineEvent[];
  categoryMap: Map<string, Category>;
  view: Viewport;
  domain: Domain;
  onViewChange: (view: Viewport) => void;
}

export function Minimap({ events, categoryMap, view, domain, onViewChange }: Props) {
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
        return {
          from: extent.from,
          to: extent.to,
          color: categoryColor(event.categoryId, categoryMap),
        };
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
      marks,
      theme: LIGHT_THEME,
    });
  }, [width, domain, viewFrom, viewTo, marks]);

  const span = Math.max(domain.max - domain.min, 1);
  const tAt = (x: number) => domain.min + (x / Math.max(width, 1)) * span;

  const moveWindowTo = (centerT: number) => {
    const visibleYears = view.width / view.pxPerYear;
    onViewChange(clampViewport({ ...view, t0: centerT - visibleYears / 2 }, domain));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const t = tAt(x);
    event.currentTarget.setPointerCapture(event.pointerId);
    const insideWindow = t >= viewFrom && t <= viewTo;
    dragging.current = { grabOffset: insideWindow ? t - (viewFrom + viewTo) / 2 : 0 };
    if (!insideWindow) moveWindowTo(t);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    moveWindowTo(tAt(x) - dragging.current.grabOffset);
  };

  const endDrag = () => {
    dragging.current = null;
  };

  return (
    <div className="minimap" ref={wrapperRef} title={cs.timeline.minimapHint}>
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
