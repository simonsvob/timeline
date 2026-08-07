/**
 * Rozvržení osy „Řeka": jedna centrální vodorovná čára, bodové události nad ní
 * jako pilulky na stopce, životy a období pod ní jako zaoblené pruhy.
 *
 * Čistá funkce bez plátna (měření textu se předává), aby šla testovat.
 */

import { packLanes, type LaneInput } from '../../lib/lanes';
import { openDirection, toContinuous, toContinuousCenter } from '../../lib/time';
import { xOf, type Viewport } from '../../lib/viewport';
import type { Category, TimelineEvent } from '../../data/types';

// --- svislá geometrie (v CSS pixelech od centrální čáry) ---------------------

/** Tloušťka centrální čáry. */
export const AXIS_LINE_HEIGHT = 3;
/** Kolik místa pod čárou zabírají popisky let. */
export const AXIS_LABEL_SPACE = 30;

/** Výška řádku pilulek nad čárou. */
export const POINT_LANE_HEIGHT = 56;
/** Střed prvního řádku pilulek nad čárou. */
export const POINT_FIRST_OFFSET = 90;
export const PILL_HEIGHT = 34;
export const PILL_PADDING_X = 14;
/** Mezera mezi jménem a rokem v pilulce. */
export const PILL_GAP = 7;
export const NODE_RADIUS = 6.5;

/** Výška řádku pruhů pod čárou. */
export const RANGE_LANE_HEIGHT = 44;
/** Horní hrana prvního řádku pruhů pod čárou. */
export const RANGE_FIRST_OFFSET = 36;
export const BAR_HEIGHT = 28;
/** Odsazení popisku uvnitř pruhu. */
export const BAR_LABEL_INSET = 13;
export const BAR_LABEL_GAP = 9;
/** Mezera mezi pruhem a popiskem vedle něj. */
export const LABEL_GAP = 10;
/** Mezera mezi sousedy v jednom řádku. */
export const ITEM_GAP = 10;
/** Šipka za otevřenou hranicí. */
export const OPEN_END_WIDTH = 13;
export const NO_CATEGORY_COLOR = '#9a9384';

/**
 * Nad tento počet řádků v pásmu rozsahů se přestane rezervovat místo pro
 * popisky – jinak by osa při maximálním oddálení narostla do nesmyslné výšky.
 */
export const MAX_LANES_WITH_LABELS = 40;

/**
 * Kolik řádků pilulek smí stát nad čárou. Co se nevejde, zůstane jen uzlem na
 * čáře a popisek se ukáže po najetí nebo v detailu; jinak by při oddálení
 * pilulky vytlačily osu mimo obrazovku.
 */
export const MAX_POINT_LANES = 5;

export type Band = 'point' | 'range';

/** Jak se popisek pruhu vejde; degraduje odshora dolů. */
export type LabelMode = 'inside-full' | 'inside-name' | 'outside-full' | 'outside-name' | 'none';

export interface EventGeometry {
  event: TimelineEvent;
  band: Band;
  /** 0 = řádek nejblíž centrální čáře */
  lane: number;
  /** levý okraj pruhu, u bodu levý okraj pilulky */
  x1: number;
  /** pravý okraj pruhu, u bodu pravý okraj pilulky */
  x2: number;
  /** poloha uzlu na čáře (bod) nebo střed pruhu (rozsah) */
  centerX: number;
  color: string;
  name: string;
  nameWidth: number;
  /** formátované roky vedle jména */
  years: string;
  yearsWidth: number;
  labelMode: LabelMode;
  labelX: number;
  startApprox: boolean;
  endApprox: boolean;
  /** strana, na kterou je hranice otevřená (null = uzavřená) */
  startOpen: 'left' | 'right' | null;
  endOpen: 'left' | 'right' | null;
  isPoint: boolean;
}

export interface LayoutResult {
  items: EventGeometry[];
  /** počet řádků nad čárou */
  pointLaneCount: number;
  /** počet řádků pod čárou */
  rangeLaneCount: number;
  /** kolik pixelů zabírá obsah nad čárou */
  heightAbove: number;
  /** kolik pixelů zabírá obsah pod čárou */
  heightBelow: number;
  labelsReserved: boolean;
}

export type MeasureText = (text: string, weight?: 'normal' | 'bold') => number;

/** Rozsah záznamu na spojité ose (pro rozsah i bod). */
export function eventExtent(event: TimelineEvent): { from: number; to: number } {
  if (event.type === 'range' && event.end) {
    return { from: toContinuous(event.start, 'start'), to: toContinuous(event.end, 'end') };
  }
  const center = toContinuousCenter(event.start);
  return { from: center, to: center };
}

export function categoryColor(
  categoryId: string | null,
  categories: Map<string, Category>,
): string {
  if (!categoryId) return NO_CATEGORY_COLOR;
  return categories.get(categoryId)?.color ?? NO_CATEGORY_COLOR;
}

/** Svislá poloha středu pilulky nad čárou. */
export function pointLaneY(lane: number): number {
  return -(POINT_FIRST_OFFSET + lane * POINT_LANE_HEIGHT);
}

/** Svislá poloha středu pruhu pod čárou. */
export function rangeLaneY(lane: number): number {
  return RANGE_FIRST_OFFSET + lane * RANGE_LANE_HEIGHT + BAR_HEIGHT / 2;
}

interface Measured {
  event: TimelineEvent;
  isPoint: boolean;
  x1: number;
  x2: number;
  centerX: number;
  color: string;
  name: string;
  nameWidth: number;
  years: string;
  yearsWidth: number;
  startApprox: boolean;
  endApprox: boolean;
  startOpen: 'left' | 'right' | null;
  endOpen: 'left' | 'right' | null;
  /** šířka pilulky (jen u bodů) */
  pillWidth: number;
}

/** Vybere nejbohatší popisek, který se do pruhu (nebo vedle něj) vejde. */
function chooseLabelMode(m: Measured, reserveOutside: boolean): LabelMode {
  if (m.isPoint) return 'inside-full';
  const usable = m.x2 - m.x1 - BAR_LABEL_INSET - 12;
  if (usable >= m.nameWidth + BAR_LABEL_GAP + m.yearsWidth) return 'inside-full';
  if (usable >= m.nameWidth) return 'inside-name';
  if (!reserveOutside) return 'none';
  return 'outside-full';
}

/** Kolik místa si položka nárokuje vpravo od sebe (popisek, šipka). */
function occupiedRightOf(m: Measured, mode: LabelMode): number {
  const openRight = (m.isPoint ? m.startOpen : m.endOpen) === 'right';
  const arrow = openRight ? OPEN_END_WIDTH : 0;
  if (m.isPoint) return m.x2 + arrow;
  switch (mode) {
    case 'outside-full':
      return m.x2 + arrow + LABEL_GAP + m.nameWidth + BAR_LABEL_GAP + m.yearsWidth;
    case 'outside-name':
      return m.x2 + arrow + LABEL_GAP + m.nameWidth;
    default:
      return m.x2 + arrow;
  }
}

/**
 * Spočítá rozvržení. Pakuje VŠECHNY předané záznamy (ne jen viditelné), aby
 * se řádky při posunu neměnily; vykreslení si viditelné vybere samo.
 */
export function layoutEvents(
  events: TimelineEvent[],
  view: Viewport,
  categories: Map<string, Category>,
  measureText: MeasureText,
  formatYears: (event: TimelineEvent) => string,
): LayoutResult {
  const measured: Measured[] = events.map((event) => {
    const extent = eventExtent(event);
    const isPoint = event.type !== 'range' || !event.end;
    const rawX1 = xOf(view, extent.from);
    const rawX2 = xOf(view, extent.to);
    const centerX = isPoint ? rawX1 : (rawX1 + rawX2) / 2;
    const name = event.name;
    const years = formatYears(event);
    const nameWidth = measureText(name, 'bold');
    const yearsWidth = measureText(years);
    const pillWidth = PILL_PADDING_X * 2 + nameWidth + (years ? PILL_GAP + yearsWidth : 0);

    return {
      event,
      isPoint,
      x1: isPoint ? centerX - pillWidth / 2 : rawX1,
      x2: isPoint ? centerX + pillWidth / 2 : Math.max(rawX2, rawX1 + 3),
      centerX,
      color: categoryColor(event.categoryId, categories),
      name,
      nameWidth,
      years,
      yearsWidth,
      startApprox: event.start.approx,
      endApprox: isPoint ? false : (event.end?.approx ?? false),
      startOpen: openDirection(event.start.qualifier),
      endOpen: isPoint ? null : openDirection(event.end?.qualifier ?? null),
      pillWidth,
    };
  });

  const points = measured.filter((m) => m.isPoint);
  const ranges = measured.filter((m) => !m.isPoint);

  const pack = (skupina: Measured[], reserveOutside: boolean) => {
    const inputs: LaneInput[] = skupina.map((m) => {
      const openLeft = (m.isPoint ? m.startOpen : m.startOpen) === 'left';
      return {
        id: m.event.id,
        left: m.x1 - (openLeft ? OPEN_END_WIDTH : 0),
        right: occupiedRightOf(m, chooseLabelMode(m, reserveOutside)),
      };
    });
    return packLanes(inputs, ITEM_GAP);
  };

  const packedPoints = pack(points, true);
  let packedRanges = pack(ranges, true);
  let labelsReserved = true;

  if (packedRanges.laneCount > MAX_LANES_WITH_LABELS) {
    packedRanges = pack(ranges, false);
    labelsReserved = false;
  }

  // Body nad limitem přijdou o pilulku a spadnou zpátky na čáru.
  const pillHidden = new Set<string>();
  for (const [id, lane] of packedPoints.lanes) {
    if (lane >= MAX_POINT_LANES) pillHidden.add(id);
  }
  const pointLaneCount = Math.min(packedPoints.laneCount, MAX_POINT_LANES);

  const items: EventGeometry[] = measured.map((m) => {
    const band: Band = m.isPoint ? 'point' : 'range';
    const packed = m.isPoint ? packedPoints : packedRanges;
    const bezPilulky = m.isPoint && pillHidden.has(m.event.id);
    const lane = bezPilulky ? 0 : (packed.lanes.get(m.event.id) ?? 0);
    const mode: LabelMode = bezPilulky ? 'none' : chooseLabelMode(m, labelsReserved);

    let labelX: number;
    if (m.isPoint) {
      labelX = m.x1 + PILL_PADDING_X;
    } else if (mode === 'inside-full' || mode === 'inside-name') {
      // „Přilepený" popisek: u pruhu delšího než výřez zůstane u okraje plátna.
      const from = m.x1 + BAR_LABEL_INSET;
      const width = mode === 'inside-full' ? m.nameWidth + BAR_LABEL_GAP + m.yearsWidth : m.nameWidth;
      const max = m.x2 - width - 12;
      labelX = Math.min(Math.max(from, BAR_LABEL_INSET), Math.max(max, from));
    } else {
      labelX = m.x2 + (m.endOpen === 'right' ? OPEN_END_WIDTH : 0) + LABEL_GAP;
    }

    return {
      event: m.event,
      band,
      lane,
      x1: m.x1,
      x2: m.x2,
      centerX: m.centerX,
      color: m.color,
      name: m.name,
      nameWidth: m.nameWidth,
      years: m.years,
      yearsWidth: m.yearsWidth,
      labelMode: mode,
      labelX,
      startApprox: m.startApprox,
      endApprox: m.endApprox,
      startOpen: m.startOpen,
      endOpen: m.endOpen,
      isPoint: m.isPoint,
    };
  });

  return {
    items,
    pointLaneCount,
    rangeLaneCount: packedRanges.laneCount,
    heightAbove:
      pointLaneCount === 0
        ? 0
        : POINT_FIRST_OFFSET + (pointLaneCount - 1) * POINT_LANE_HEIGHT + PILL_HEIGHT / 2,
    heightBelow:
      AXIS_LABEL_SPACE +
      (packedRanges.laneCount === 0
        ? 0
        : RANGE_FIRST_OFFSET + (packedRanges.laneCount - 1) * RANGE_LANE_HEIGHT + BAR_HEIGHT),
    labelsReserved,
  };
}

/**
 * Zásah kliknutím. `y` je vzdálenost od centrální čáry (záporná = nad ní).
 */
export function hitTest(layout: LayoutResult, x: number, yFromAxis: number): EventGeometry | null {
  let best: EventGeometry | null = null;
  for (const item of layout.items) {
    const centerY = item.isPoint ? pointLaneY(item.lane) : rangeLaneY(item.lane);
    const half = (item.isPoint ? PILL_HEIGHT : BAR_HEIGHT) / 2 + 4;
    if (Math.abs(yFromAxis - centerY) > half) continue;

    const outside = item.labelMode === 'outside-full' || item.labelMode === 'outside-name';
    const labelWidth =
      item.labelMode === 'outside-full'
        ? item.nameWidth + BAR_LABEL_GAP + item.yearsWidth
        : item.nameWidth;
    const left = item.x1 - 4;
    const right = (outside ? item.labelX + labelWidth : item.x2) + 4;
    if (x < left || x > right) continue;

    // kratší záznam vyhrává, aby šlo trefit krátký pruh ležící u dlouhého
    if (!best || item.x2 - item.x1 < best.x2 - best.x1) best = item;
  }
  return best;
}
