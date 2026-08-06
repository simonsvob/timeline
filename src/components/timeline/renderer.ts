/**
 * Vykreslení osy na Canvas 2D.
 *
 * Canvas (ne SVG) proto, že při stovkách až tisících záznamů a plynulém zoomu
 * je potřeba překreslit celý výřez v každém snímku; DOM by u tisíců uzlů
 * nestíhal. Kreslí se jen viditelný výřez – položky mimo plátno se přeskočí.
 *
 * Jistota se vykresluje takto:
 *   - přibližný konec/začátek pruhu = plynulý přechod do průhledna,
 *   - jistý konec = ostrá hrana,
 *   - přibližný bod = měkké gradientní halo, jistý bod = plná ostrá značka.
 */

import type { Tick, Viewport } from '../../lib/viewport';
import { xOf } from '../../lib/viewport';
import { BAR_HEIGHT, LANE_HEIGHT, POINT_RADIUS, type EventGeometry, type LayoutResult } from './layout';

export const AXIS_HEIGHT = 44;

export interface Theme {
  background: string;
  axisBackground: string;
  axisText: string;
  axisTextMajor: string;
  gridLine: string;
  gridLineMajor: string;
  epochLine: string;
  label: string;
  labelOnBar: string;
  selection: string;
  tooltipBackground: string;
  tooltipText: string;
  laneStripe: string;
}

export const LIGHT_THEME: Theme = {
  background: '#fbfaf7',
  axisBackground: '#f2efe9',
  axisText: '#6b6459',
  axisTextMajor: '#2f2a24',
  gridLine: 'rgba(90, 80, 65, 0.08)',
  gridLineMajor: 'rgba(90, 80, 65, 0.18)',
  epochLine: 'rgba(163, 86, 60, 0.55)',
  label: '#332e28',
  labelOnBar: '#ffffff',
  selection: '#1b1815',
  tooltipBackground: 'rgba(32, 28, 24, 0.92)',
  tooltipText: '#ffffff',
  laneStripe: 'rgba(90, 80, 65, 0.035)',
};

export interface RenderInput {
  ctx: CanvasRenderingContext2D;
  view: Viewport;
  layout: LayoutResult;
  ticks: Tick[];
  /** výška oblasti se záznamy (bez měřítka), v CSS pixelech */
  contentHeight: number;
  scrollTop: number;
  selectedId: string | null;
  hoveredId: string | null;
  theme: Theme;
  labelFont: string;
  axisFont: string;
}

// ---------------------------------------------------------------------------
// Barvy
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim().replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const int = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(int)) return [154, 160, 166];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Relativní jas – rozhoduje, jestli je popisek na pruhu bílý, nebo tmavý. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function textColorOn(hex: string, theme: Theme): string {
  return relativeLuminance(hex) > 0.55 ? theme.label : theme.labelOnBar;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Hlavní vykreslení
// ---------------------------------------------------------------------------

/** Maximální délka náběhu do ztracena v pixelech. */
const MAX_FADE_PX = 56;

export function renderTimeline(input: RenderInput): void {
  const { ctx, view, layout, ticks, contentHeight, scrollTop, theme } = input;
  const width = view.width;
  const totalHeight = AXIS_HEIGHT + contentHeight;

  ctx.clearRect(0, 0, width, totalHeight);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, totalHeight);

  drawLaneStripes(ctx, layout, contentHeight, scrollTop, theme, width);
  drawGrid(ctx, view, ticks, contentHeight, theme);
  drawEvents(ctx, input);
  drawAxis(ctx, view, ticks, theme, input.axisFont);
}

function drawLaneStripes(
  ctx: CanvasRenderingContext2D,
  layout: LayoutResult,
  contentHeight: number,
  scrollTop: number,
  theme: Theme,
  width: number,
): void {
  const firstLane = Math.max(0, Math.floor(scrollTop / LANE_HEIGHT));
  const lastLane = Math.min(layout.laneCount - 1, Math.ceil((scrollTop + contentHeight) / LANE_HEIGHT));
  ctx.fillStyle = theme.laneStripe;
  for (let lane = firstLane; lane <= lastLane; lane++) {
    if (lane % 2 === 1) continue;
    const y = AXIS_HEIGHT + lane * LANE_HEIGHT - scrollTop;
    ctx.fillRect(0, y, width, LANE_HEIGHT);
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  ticks: Tick[],
  contentHeight: number,
  theme: Theme,
): void {
  const top = AXIS_HEIGHT;
  const bottom = AXIS_HEIGHT + contentHeight;
  for (const tick of ticks) {
    const x = Math.round(xOf(view, tick.t)) + 0.5;
    if (x < -1 || x > view.width + 1) continue;
    ctx.strokeStyle = tick.major ? theme.gridLineMajor : theme.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  // Přelom letopočtu: 1 př. n. l. (astronomicky 0) bezprostředně předchází 1 n. l.
  const epochX = Math.round(xOf(view, 1)) + 0.5;
  if (epochX >= 0 && epochX <= view.width) {
    ctx.strokeStyle = theme.epochLine;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(epochX, top);
    ctx.lineTo(epochX, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawAxis(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  ticks: Tick[],
  theme: Theme,
  axisFont: string,
): void {
  ctx.fillStyle = theme.axisBackground;
  ctx.fillRect(0, 0, view.width, AXIS_HEIGHT);
  ctx.strokeStyle = theme.gridLineMajor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, AXIS_HEIGHT - 0.5);
  ctx.lineTo(view.width, AXIS_HEIGHT - 0.5);
  ctx.stroke();

  ctx.font = axisFont;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (const tick of ticks) {
    const x = Math.round(xOf(view, tick.t)) + 0.5;
    if (x < -60 || x > view.width + 60) continue;

    ctx.strokeStyle = tick.major ? theme.gridLineMajor : theme.gridLine;
    ctx.beginPath();
    ctx.moveTo(x, tick.major ? AXIS_HEIGHT - 14 : AXIS_HEIGHT - 8);
    ctx.lineTo(x, AXIS_HEIGHT);
    ctx.stroke();

    ctx.fillStyle = tick.major ? theme.axisTextMajor : theme.axisText;
    ctx.fillText(tick.label, x + 5, AXIS_HEIGHT / 2 - 2);
  }
}

function drawEvents(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { layout, contentHeight, scrollTop, theme, view, selectedId, hoveredId } = input;
  const firstLane = Math.max(0, Math.floor(scrollTop / LANE_HEIGHT) - 1);
  const lastLane = Math.ceil((scrollTop + contentHeight) / LANE_HEIGHT) + 1;

  ctx.font = input.labelFont;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  let hovered: EventGeometry | null = null;

  for (const item of layout.items) {
    // vertikální ořez
    if (item.lane < firstLane || item.lane > lastLane) continue;
    // horizontální ořez (s rezervou na popisek)
    const rightmost = item.showLabel && !item.labelInside ? item.labelX + item.labelWidth : item.x2;
    if (rightmost < -8 || item.x1 > view.width + 8) continue;

    const y = AXIS_HEIGHT + item.lane * LANE_HEIGHT - scrollTop;
    const centerY = y + LANE_HEIGHT / 2;
    const selected = item.event.id === selectedId;
    const isHovered = item.event.id === hoveredId;
    if (isHovered) hovered = item;

    if (item.isPoint) {
      drawPoint(ctx, item, centerY, selected || isHovered, theme);
    } else {
      drawBar(ctx, item, centerY, selected || isHovered, theme, view.width);
    }

    if (item.showLabel) {
      ctx.fillStyle = item.labelInside ? textColorOn(item.color, theme) : theme.label;
      ctx.fillText(item.label, item.labelX, centerY);
    }
  }

  if (hovered && !hovered.showLabel) drawTooltip(ctx, hovered, scrollTop, theme, view.width);
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  item: EventGeometry,
  centerY: number,
  emphasized: boolean,
  theme: Theme,
  viewWidth: number,
): void {
  // Ořez na okolí plátna, ať gradient nepočítá s extrémními souřadnicemi
  const x1 = Math.max(item.x1, -MAX_FADE_PX * 2);
  const x2 = Math.min(item.x2, viewWidth + MAX_FADE_PX * 2);
  const w = Math.max(x2 - x1, 2);
  const y = centerY - BAR_HEIGHT / 2;

  roundRectPath(ctx, x1, y, w, BAR_HEIGHT, BAR_HEIGHT / 2);

  if (item.startApprox || item.endApprox) {
    // Plynulý přechod do ztracena na nejisté straně; jistá strana zůstává ostrá.
    const fade = Math.min(MAX_FADE_PX, w * 0.4);
    const gradient = ctx.createLinearGradient(x1, 0, x2, 0);
    const fadeStop = w > 0 ? fade / w : 0.4;
    if (item.startApprox) {
      gradient.addColorStop(0, rgba(item.color, 0));
      gradient.addColorStop(Math.min(fadeStop, 0.5), rgba(item.color, 1));
    } else {
      gradient.addColorStop(0, rgba(item.color, 1));
    }
    if (item.endApprox) {
      gradient.addColorStop(Math.max(1 - fadeStop, 0.5), rgba(item.color, 1));
      gradient.addColorStop(1, rgba(item.color, 0));
    } else {
      gradient.addColorStop(1, rgba(item.color, 1));
    }
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = item.color;
  }
  ctx.fill();

  if (emphasized) {
    ctx.strokeStyle = theme.selection;
    ctx.lineWidth = 2;
    roundRectPath(ctx, x1 - 1, y - 1, w + 2, BAR_HEIGHT + 2, (BAR_HEIGHT + 2) / 2);
    ctx.stroke();
  }
}

function drawPoint(
  ctx: CanvasRenderingContext2D,
  item: EventGeometry,
  centerY: number,
  emphasized: boolean,
  theme: Theme,
): void {
  const x = item.centerX;

  if (item.startApprox) {
    // Měkké halo – vizuálně ladí s mizejícími konci pruhů.
    const haloRadius = POINT_RADIUS * 2.6;
    const halo = ctx.createRadialGradient(x, centerY, 0, x, centerY, haloRadius);
    halo.addColorStop(0, rgba(item.color, 0.85));
    halo.addColorStop(0.45, rgba(item.color, 0.45));
    halo.addColorStop(1, rgba(item.color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, centerY, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgba(item.color, 0.9);
    ctx.beginPath();
    ctx.arc(x, centerY, POINT_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(x, centerY, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  if (emphasized) {
    ctx.strokeStyle = theme.selection;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, centerY, POINT_RADIUS + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  item: EventGeometry,
  scrollTop: number,
  theme: Theme,
  viewWidth: number,
): void {
  const text = item.label;
  const paddingX = 8;
  const paddingY = 5;
  const width = ctx.measureText(text).width + paddingX * 2;
  const height = 24;
  const centerY = AXIS_HEIGHT + item.lane * LANE_HEIGHT + LANE_HEIGHT / 2 - scrollTop;
  const x = Math.min(Math.max(item.centerX - width / 2, 4), viewWidth - width - 4);
  const y = centerY - LANE_HEIGHT / 2 - height - 2;

  ctx.fillStyle = theme.tooltipBackground;
  roundRectPath(ctx, x, y, width, height, 6);
  ctx.fill();
  ctx.fillStyle = theme.tooltipText;
  ctx.fillText(text, x + paddingX, y + height / 2 + 0.5);
  void paddingY;
}

// ---------------------------------------------------------------------------
// Minimapa
// ---------------------------------------------------------------------------

export interface MinimapInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  domainMin: number;
  domainMax: number;
  /** začátek a konec aktuálního výřezu na spojité ose */
  viewFrom: number;
  viewTo: number;
  marks: { from: number; to: number; color: string }[];
  theme: Theme;
}

export function renderMinimap(input: MinimapInput): void {
  const { ctx, width, height, domainMin, domainMax, viewFrom, viewTo, marks, theme } = input;
  const span = Math.max(domainMax - domainMin, 1);
  const toX = (t: number) => ((t - domainMin) / span) * width;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.axisBackground;
  ctx.fillRect(0, 0, width, height);

  const trackTop = 4;
  const trackHeight = height - 8;
  for (const mark of marks) {
    const x1 = toX(mark.from);
    const x2 = Math.max(toX(mark.to), x1 + 1.5);
    ctx.fillStyle = rgba(mark.color, 0.65);
    ctx.fillRect(x1, trackTop, x2 - x1, trackHeight);
  }

  // aktuální výřez
  const wx1 = Math.max(toX(viewFrom), 0);
  const wx2 = Math.min(toX(viewTo), width);
  ctx.fillStyle = 'rgba(20, 18, 15, 0.10)';
  ctx.fillRect(0, 0, wx1, height);
  ctx.fillRect(wx2, 0, width - wx2, height);

  ctx.strokeStyle = theme.selection;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(Math.round(wx1) + 0.5, 0.75, Math.max(Math.round(wx2 - wx1) - 1, 2), height - 1.5);
}
