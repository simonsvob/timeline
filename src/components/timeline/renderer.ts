/**
 * Vykreslení osy „Řeka" na Canvas 2D.
 *
 * Canvas (ne SVG) proto, že při stovkách až tisících záznamů a plynulém zoomu
 * je potřeba překreslit celý výřez v každém snímku. Kreslí se jen viditelný
 * výřez – položky mimo plátno se přeskočí.
 *
 * Jazyk nejistoty:
 *   - jistá hranice = ostrá hrana s výraznějším obrysem,
 *   - přibližná hranice = výplň se rozplyne do průhledna, obrys ji sleduje,
 *   - otevřená hranice = šipka na tu stranu, na kterou je údaj otevřený.
 */

import type { Tick, Viewport } from '../../lib/viewport';
import { xOf } from '../../lib/viewport';
import {
  AXIS_LINE_HEIGHT,
  BAR_HEIGHT,
  BAR_LABEL_GAP,
  BAR_RADIUS,
  NODE_RADIUS,
  OPEN_END_WIDTH,
  PILL_HEIGHT,
  PILL_GAP,
  PILL_PADDING_X,
  pointLaneY,
  rangeLaneY,
  type EventGeometry,
  type LayoutResult,
} from './layout';

export interface Theme {
  background: string;
  card: string;
  border: string;
  text: string;
  barText: string;
  muted: string;
  tertiary: string;
  gridDot: string;
  tick: string;
  selection: string;
  shadow: string;
}

/** Teplá slonovina podle návrhu; stíny nikdy čistě černé, vždy do hněda. */
export const THEME: Theme = {
  background: '#fbfaf6',
  card: '#ffffff',
  border: 'rgba(70, 58, 30, 0.06)',
  text: '#262218',
  barText: '#33301f',
  muted: '#8a8274',
  tertiary: '#a29a88',
  gridDot: 'rgba(70, 58, 30, 0.09)',
  tick: 'rgba(70, 58, 30, 0.28)',
  selection: '#262218',
  shadow: 'rgba(70, 58, 30, 0.18)',
};

/** Úsek osy s vlastní barvou (období). */
export interface PeriodSpan {
  from: number;
  to: number;
  color: string;
}

export interface RenderInput {
  ctx: CanvasRenderingContext2D;
  view: Viewport;
  layout: LayoutResult;
  ticks: Tick[];
  /** výška plátna v CSS pixelech */
  height: number;
  /** svislá poloha centrální čáry */
  axisY: number;
  periods: PeriodSpan[];
  selectedId: string | null;
  hoveredId: string | null;
  theme: Theme;
  nameFont: string;
  yearFont: string;
  tickFont: string;
}

// ---------------------------------------------------------------------------
// Barvy
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim().replace('#', '');
  const full =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized;
  const int = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(int)) return [154, 147, 132];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Barva ztmavená k černé – popisek v barvě kategorie musí zůstat čitelný. */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (c: number) => Math.round(c * (1 - amount));
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
}

/** Barva smíchaná s bílou – výplň pruhu je kategorie na 15 %. */
export function mixWithWhite(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (c: number) => Math.round(c * ratio + 255 * (1 - ratio));
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
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

function withShadow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  offsetY: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = offsetY;
  draw();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Hlavní vykreslení
// ---------------------------------------------------------------------------

export function renderTimeline(input: RenderInput): void {
  const { ctx, view, theme, height } = input;

  ctx.clearRect(0, 0, view.width, height);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, view.width, height);

  drawGrid(input);
  drawAxis(input);
  drawRanges(input);
  drawPoints(input);
}

/** Tečkované svislé linky v místech dělení. */
function drawGrid(input: RenderInput): void {
  const { ctx, view, ticks, theme, height } = input;
  const top = 96;
  const bottom = height - 96;
  if (bottom <= top) return;

  ctx.strokeStyle = theme.gridDot;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  for (const tick of ticks) {
    const x = Math.round(xOf(view, tick.t)) + 0.5;
    if (x < 0 || x > view.width) continue;
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Centrální čára obarvená podle období pod výřezem, s plynulými přechody.
 * Gradient se skládá jen z období, která do výřezu zasahují.
 */
function drawAxis(input: RenderInput): void {
  const { ctx, view, ticks, theme, axisY, periods } = input;
  const y = Math.round(axisY);

  let fill: string | CanvasGradient = theme.tick;
  const visible = periods
    .filter((p) => xOf(view, p.to) > 0 && xOf(view, p.from) < view.width)
    .sort((a, b) => a.from - b.from);

  if (visible.length === 1) {
    fill = visible[0].color;
  } else if (visible.length > 1) {
    const gradient = ctx.createLinearGradient(0, 0, view.width, 0);
    const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
    for (const period of visible) {
      const from = clamp01(xOf(view, period.from) / view.width);
      const to = clamp01(xOf(view, period.to) / view.width);
      // Přechod mezi sousedy: barva drží uvnitř období a v poslední pětině
      // úseku se přelévá do další – proto dvě zarážky na každé straně.
      const prelevani = Math.min((to - from) * 0.22, 0.06);
      gradient.addColorStop(clamp01(from + prelevani), period.color);
      gradient.addColorStop(clamp01(Math.max(to - prelevani, from + prelevani)), period.color);
    }
    fill = gradient;
  }

  roundRectPath(ctx, 0, y - AXIS_LINE_HEIGHT / 2, view.width, AXIS_LINE_HEIGHT, 2);
  ctx.fillStyle = fill;
  ctx.fill();

  // ticky a popisky let těsně pod čárou
  ctx.font = input.tickFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const tick of ticks) {
    const x = Math.round(xOf(view, tick.t)) + 0.5;
    if (x < -40 || x > view.width + 40) continue;
    ctx.strokeStyle = theme.tick;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + AXIS_LINE_HEIGHT / 2);
    ctx.lineTo(x, y + AXIS_LINE_HEIGHT / 2 + 9);
    ctx.stroke();
    ctx.fillStyle = theme.tertiary;
    ctx.fillText(tick.label, x, y + 19);
  }
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
// Životy a období pod čárou
// ---------------------------------------------------------------------------

function drawRanges(input: RenderInput): void {
  const { layout, view, axisY, selectedId, hoveredId } = input;

  for (const item of layout.items) {
    if (item.isPoint) continue;
    const rightmost =
      item.labelMode === 'outside-full'
        ? item.labelX + item.nameWidth + BAR_LABEL_GAP + item.yearsWidth
        : item.labelMode === 'outside-name'
          ? item.labelX + item.nameWidth
          : item.x2;
    if (rightmost < -8 || item.x1 > view.width + 8) continue;

    const centerY = axisY + rangeLaneY(item.lane);
    if (centerY < -BAR_HEIGHT || centerY > input.height + BAR_HEIGHT) continue;

    drawBar(input, item, centerY, item.event.id === selectedId, item.event.id === hoveredId);
  }
}

function drawBar(
  input: RenderInput,
  item: EventGeometry,
  centerY: number,
  selected: boolean,
  hovered: boolean,
): void {
  const { ctx, view, theme } = input;
  const x1 = Math.max(item.x1, -MAX_OVERFLOW);
  const x2 = Math.min(item.x2, view.width + MAX_OVERFLOW);
  const w = Math.max(x2 - x1, 3);
  const y = centerY - BAR_HEIGHT / 2 - (hovered ? 1 : 0);

  // Přibližná hranice = OTEVŘENÝ kraj: políčko vypadá stejně jako u jistých
  // roků, jen se na té straně neuzavře — obrys tam vede jen nahoře a dole.
  // Ořez na okraj plátna nesmí kraj „uzavřít", proto se hlídá i přesah.
  const openLeft = item.startApprox || item.x1 < -MAX_OVERFLOW;
  const openRight = item.endApprox || item.x2 > view.width + MAX_OVERFLOW;

  // Otevřený kraj se kreslí tak, že tvar přesahuje za ořez a zaoblený roh
  // zůstane mimo viditelnou oblast. Výplň i obrys tak sdílejí jednu cestu –
  // ručně skládané oblouky se u krátkých pruhů rozpadaly na kroužky.
  const presah = BAR_RADIUS + 4;
  const pathX1 = openLeft ? x1 - presah : x1;
  const pathX2 = openRight ? x2 + presah : x2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x1, y - 4, w, BAR_HEIGHT + 8);
  ctx.clip();

  barPath(ctx, pathX1, y, pathX2 - pathX1, BAR_HEIGHT, BAR_RADIUS);
  if (hovered || selected) {
    withShadow(ctx, theme.shadow, hovered ? 20 : 10, hovered ? 7 : 3, () => {
      ctx.fillStyle = mixWithWhite(item.color, 0.15);
      ctx.fill();
    });
  }
  ctx.fillStyle = mixWithWhite(item.color, 0.15);
  ctx.fill();

  barPath(ctx, pathX1 + 0.5, y + 0.5, pathX2 - pathX1 - 1, BAR_HEIGHT - 1, BAR_RADIUS - 0.5);
  ctx.strokeStyle = rgba(item.color, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();

  if (selected) {
    barPath(ctx, pathX1 - 1.5, y - 1.5, pathX2 - pathX1 + 3, BAR_HEIGHT + 3, BAR_RADIUS + 1.5);
    ctx.strokeStyle = theme.selection;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  if (item.startOpen === 'left' && x1 > -OPEN_END_WIDTH) {
    drawOpenArrow(ctx, x1 - 3, centerY - (hovered ? 1 : 0), item.color, 'left');
  }
  if (item.endOpen === 'right' && x2 < view.width + OPEN_END_WIDTH) {
    drawOpenArrow(ctx, x2 + 3, centerY - (hovered ? 1 : 0), item.color, 'right');
  }

  drawBarLabel(input, item, centerY - (hovered ? 1 : 0));
}

/** Obdélník s kulatými rohy; poloměr se u úzkých tvarů srazí na polovinu šířky. */
function barPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

const MAX_OVERFLOW = 120;

function drawBarLabel(input: RenderInput, item: EventGeometry, centerY: number): void {
  const { ctx, theme } = input;
  if (item.labelMode === 'none') return;

  // Jméno nese barvu kategorie, jen ztmavenou do čitelnosti; roky tutéž barvu
  // zesvětlenou, ať zůstanou druhotné a nesplývají s neutrální šedí.
  const nameColor = darken(item.color, 0.42);
  ctx.textBaseline = 'middle';
  ctx.font = input.nameFont;
  ctx.fillStyle = nameColor;
  ctx.fillText(item.name, item.labelX, centerY);

  if (item.labelMode === 'inside-full' || item.labelMode === 'outside-full') {
    ctx.font = input.yearFont;
    ctx.fillStyle = rgba(item.color, 0.75);
    ctx.fillText(item.years, item.labelX + item.nameWidth + BAR_LABEL_GAP, centerY + 0.5);
  }
  void theme;
}

function drawOpenArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  color: string,
  direction: 'left' | 'right',
): void {
  const h = 14;
  const w = 9;
  const sign = direction === 'right' ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(x, centerY - h / 2);
  ctx.lineTo(x + sign * w, centerY);
  ctx.lineTo(x, centerY + h / 2);
  ctx.closePath();
  ctx.fillStyle = rgba(color, 0.7);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Bodové události nad čárou
// ---------------------------------------------------------------------------

function drawPoints(input: RenderInput): void {
  const { ctx, layout, view, axisY, theme, selectedId, hoveredId } = input;

  for (const item of layout.items) {
    if (!item.isPoint) continue;
    if (item.x2 < -8 || item.x1 > view.width + 8) continue;

    const centerY = axisY + pointLaneY(item.lane);
    if (centerY < -PILL_HEIGHT || centerY > input.height + PILL_HEIGHT) continue;

    const selected = item.event.id === selectedId;
    const hovered = item.event.id === hoveredId;
    const lift = hovered ? 1 : 0;
    const bezPilulky = item.labelMode === 'none';

    if (bezPilulky) {
      drawNode(input, item, selected || hovered);
      continue;
    }

    // stopka od uzlu k pilulce
    ctx.strokeStyle = rgba(item.color, 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.round(item.centerX) + 0.5, axisY);
    ctx.lineTo(Math.round(item.centerX) + 0.5, centerY + PILL_HEIGHT / 2 - lift);
    ctx.stroke();

    // pilulka
    const x = item.x1;
    const y = centerY - PILL_HEIGHT / 2 - lift;
    withShadow(ctx, theme.shadow, hovered ? 22 : 14, hovered ? 8 : 5, () => {
      roundRectPath(ctx, x, y, item.x2 - item.x1, PILL_HEIGHT, PILL_HEIGHT / 2);
      ctx.fillStyle = theme.card;
      ctx.fill();
    });
    roundRectPath(ctx, x + 0.5, y + 0.5, item.x2 - item.x1 - 1, PILL_HEIGHT - 1, PILL_HEIGHT / 2);
    ctx.strokeStyle = selected ? theme.selection : theme.border;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.font = input.nameFont;
    ctx.fillStyle = theme.text;
    ctx.fillText(item.name, x + PILL_PADDING_X, centerY - lift);
    if (item.years) {
      ctx.font = input.yearFont;
      ctx.fillStyle = theme.tertiary;
      ctx.fillText(item.years, x + PILL_PADDING_X + item.nameWidth + PILL_GAP, centerY - lift + 0.5);
    }

    if (item.startOpen) {
      drawOpenArrow(
        ctx,
        item.startOpen === 'right' ? item.centerX + NODE_RADIUS + 3 : item.centerX - NODE_RADIUS - 3,
        axisY,
        item.color,
        item.startOpen,
      );
    }

    drawNode(input, item, selected);
  }
}

/** Uzel na čáře: bílý střed s barevným prstencem kategorie. */
function drawNode(input: RenderInput, item: EventGeometry, emphasized: boolean): void {
  const { ctx, axisY, theme } = input;
  const r = emphasized ? NODE_RADIUS + 1 : NODE_RADIUS;
  withShadow(ctx, 'rgba(70, 58, 30, 0.18)', 6, 2, () => {
    ctx.beginPath();
    ctx.arc(item.centerX, axisY, r, 0, Math.PI * 2);
    ctx.fillStyle = theme.card;
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(item.centerX, axisY, r - 1.75, 0, Math.PI * 2);
  ctx.strokeStyle = emphasized ? theme.selection : item.color;
  ctx.lineWidth = 3.5;
  ctx.stroke();
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
  viewFrom: number;
  viewTo: number;
  periods: PeriodSpan[];
  marks: { from: number; to: number; color: string }[];
  theme: Theme;
}

export function renderMinimap(input: MinimapInput): void {
  const { ctx, width, height, domainMin, domainMax, viewFrom, viewTo, marks, periods, theme } = input;
  const span = Math.max(domainMax - domainMin, 1);
  const toX = (t: number) => ((t - domainMin) / span) * width;

  ctx.clearRect(0, 0, width, height);

  // dráha rozdělená podle období
  const trackY = (height - 8) / 2;
  roundRectPath(ctx, 0, trackY, width, 8, 4);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#f1ebdf';
  ctx.fillRect(0, trackY, width, 8);
  for (const period of periods) {
    const x1 = toX(period.from);
    const x2 = toX(period.to);
    ctx.fillStyle = rgba(period.color, 0.28);
    ctx.fillRect(x1, trackY, Math.max(x2 - x1, 1), 8);
  }
  for (const mark of marks) {
    const x1 = toX(mark.from);
    const x2 = Math.max(toX(mark.to), x1 + 2);
    ctx.fillStyle = rgba(mark.color, 0.75);
    ctx.fillRect(x1, trackY, x2 - x1, 8);
  }
  ctx.restore();

  // okno výřezu
  const wx1 = Math.max(toX(viewFrom), 1);
  const wx2 = Math.min(toX(viewTo), width - 1);
  roundRectPath(ctx, wx1, (height - 18) / 2, Math.max(wx2 - wx1, 6), 18, 9);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fill();
  ctx.strokeStyle = theme.selection;
  ctx.lineWidth = 2;
  ctx.stroke();
}
