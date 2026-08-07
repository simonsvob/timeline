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
import {
  BAR_HEIGHT,
  fadeWidth,
  LANE_HEIGHT,
  MAX_FADE_PX,
  OPEN_END_WIDTH,
  type EventGeometry,
  type LayoutResult,
} from './layout';

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
  background: '#fbfaf9',
  axisBackground: '#f7f7fa',
  axisText: '#7a7a88',
  axisTextMajor: '#1c1c22',
  gridLine: 'rgba(60, 60, 90, 0.065)',
  gridLineMajor: 'rgba(60, 60, 90, 0.14)',
  epochLine: 'rgba(225, 29, 72, 0.4)',
  label: '#26262e',
  labelOnBar: '#ffffff',
  selection: '#1c1c22',
  tooltipBackground: 'rgba(24, 24, 32, 0.93)',
  tooltipText: '#ffffff',
  laneStripe: 'rgba(60, 60, 90, 0.026)',
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


/** Šířka svislé čáry bodové události. */
const POINT_LINE_WIDTH = 2;
/** Jak daleko do stran sahá rozostření u přibližné události. */
const POINT_BLUR_PX = 11;
/** Průhlednost svislé čáry pod pásmem událostí (vodítko přes celou osu). */
const POINT_GUIDE_ALPHA = 0.16;

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
      drawPointLine(ctx, item, centerY, selected || isHovered, theme, input);
      // „po roce X" – rok není znám, jen že leží dál doprava
      if (item.startOpen) drawOpenEndArrow(ctx, item.centerX + POINT_LINE_WIDTH + 3, centerY, item.color);
    } else {
      drawBar(ctx, item, centerY, selected || isHovered, theme, view.width);
      // „min. X" – konec života/období není znám, čára pokračuje šipkou
      if (item.endOpen && item.x2 < view.width + OPEN_END_WIDTH) {
        drawOpenEndArrow(ctx, item.x2 + 2, centerY, item.color);
      }
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
    const fade = fadeWidth(w);
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

/**
 * Bodová událost se kreslí jako svislá čára, ne jako kolečko – jinak se plete
 * s pruhy životů. Slabé vodítko pokračuje přes celou osu dolů, aby šlo očima
 * spojit událost s životy, které v tu dobu běžely.
 *
 * Nejistota je vodorovná: přibližná událost se do stran rozostří, protože
 * nejisté je umístění v čase. Tím drží stejný jazyk jako mizející konce pruhů.
 */
function drawPointLine(
  ctx: CanvasRenderingContext2D,
  item: EventGeometry,
  centerY: number,
  emphasized: boolean,
  theme: Theme,
  input: RenderInput,
): void {
  const x = Math.round(item.centerX);
  const bandBottom = AXIS_HEIGHT + input.layout.pointLaneCount * LANE_HEIGHT - input.scrollTop;
  const contentBottom = AXIS_HEIGHT + input.contentHeight;
  const top = centerY - LANE_HEIGHT / 2 + 3;
  const bottom = centerY + LANE_HEIGHT / 2 - 3;

  // Vodítko pokračuje hned pod značkou, ne až pod celým pásmem – jinak by mezi
  // událostí a její čarou zůstala mezera a spojitost by se ztratila.
  if (bottom < contentBottom) {
    ctx.fillStyle = rgba(item.color, POINT_GUIDE_ALPHA);
    ctx.fillRect(x - 0.5, bottom, 1, contentBottom - bottom);
  }
  void bandBottom;

  if (item.startApprox) {
    // rozostření do stran – událost leží „někde tady"
    const glow = ctx.createLinearGradient(x - POINT_BLUR_PX, 0, x + POINT_BLUR_PX, 0);
    glow.addColorStop(0, rgba(item.color, 0));
    glow.addColorStop(0.5, rgba(item.color, 0.55));
    glow.addColorStop(1, rgba(item.color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - POINT_BLUR_PX, top, POINT_BLUR_PX * 2, bottom - top);
  } else {
    ctx.fillStyle = item.color;
    ctx.fillRect(x - POINT_LINE_WIDTH / 2, top, POINT_LINE_WIDTH, bottom - top);
    // patky, ať čára působí jako značka, ne jako useknutý pruh
    ctx.fillRect(x - 3, top, 6, 1.5);
    ctx.fillRect(x - 3, bottom - 1.5, 6, 1.5);
  }

  if (emphasized) {
    ctx.strokeStyle = theme.selection;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 5.5, top - 2.5, 11, bottom - top + 5);
  }
}

/**
 * Šipka za otevřenou hranicí. Záměrně se liší od přechodu do ztracena, kterým
 * se kreslí přibližnost: „min. 64 n. l." není odhad roku, ale neznámý rok.
 */
function drawOpenEndArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  color: string,
): void {
  const height = BAR_HEIGHT * 0.86;
  const width = OPEN_END_WIDTH - 3;

  // krátký dřík navazující na pruh
  ctx.fillStyle = rgba(color, 0.75);
  ctx.fillRect(x, centerY - height * 0.18, width * 0.45, height * 0.36);

  // hrot
  ctx.beginPath();
  ctx.moveTo(x + width * 0.4, centerY - height / 2);
  ctx.lineTo(x + width, centerY);
  ctx.lineTo(x + width * 0.4, centerY + height / 2);
  ctx.closePath();
  ctx.fillStyle = rgba(color, 0.75);
  ctx.fill();
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
