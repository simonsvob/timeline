/**
 * Rozvržení záznamů na ose: převede záznamy + výřez na geometrii v pixelech.
 * Čistá funkce bez plátna (měření textu se předává), aby šla testovat.
 */

import { packLanes, type LaneInput } from '../../lib/lanes';
import { toContinuous, toContinuousCenter } from '../../lib/time';
import { xOf, type Viewport } from '../../lib/viewport';
import type { Category, TimelineEvent } from '../../data/types';

export const LANE_HEIGHT = 30;
export const BAR_HEIGHT = 16;
export const POINT_RADIUS = 7;
/** Vodorovná mezera mezi pruhem a popiskem vedle něj. */
export const LABEL_GAP = 6;
/** Odsazení popisku uvnitř pruhu. */
export const LABEL_PAD = 8;
/** Mezera mezi sousedními záznamy v jednom řádku. */
export const ITEM_GAP = 10;
/** Šipka za otevřeným koncem („min." / „po roce"). */
export const OPEN_END_WIDTH = 13;
/** Prázdný řádek mezi pásmem událostí a pásmem životů. */
export const BAND_GAP_LANES = 1;
/** Maximální délka náběhu do ztracena u přibližné hranice, v pixelech. */
export const MAX_FADE_PX = 30;

/**
 * Jak dlouhý je přechod do ztracena u pruhu dané šířky. Sdílí ho rozvržení
 * i vykreslení: popisek musí začínat až za náběhem, jinak by prvních pár
 * písmen leželo v poloprůhledné části a špatně se četlo.
 */
export function fadeWidth(barWidth: number): number {
  return Math.min(MAX_FADE_PX, barWidth * 0.4);
}
/**
 * Nad tento počet řádků se přestane rezervovat místo pro popisky – jinak by
 * při maximálním oddálení s tisíci záznamy osa narostla do nesmyslné výšky.
 * Popisky, které se pak nevejdou, se skryjí (zobrazí se v detailu).
 */
export const MAX_LANES_WITH_LABELS = 60;

export const NO_CATEGORY_COLOR = '#8b8b9a';

export interface EventGeometry {
  event: TimelineEvent;
  lane: number;
  /** levý okraj pruhu (u bodu střed − poloměr) */
  x1: number;
  /** pravý okraj pruhu (u bodu střed + poloměr) */
  x2: number;
  centerX: number;
  color: string;
  label: string;
  labelWidth: number;
  labelX: number;
  /** popisek leží uvnitř pruhu (kreslí se kontrastně) */
  labelInside: boolean;
  showLabel: boolean;
  startApprox: boolean;
  endApprox: boolean;
  /** začátek je otevřený („po roce") – rok není znám */
  startOpen: boolean;
  /** konec je otevřený („min.") – rok není znám */
  endOpen: boolean;
  isPoint: boolean;
}

export interface LayoutResult {
  items: EventGeometry[];
  laneCount: number;
  height: number;
  /** kolik řádků nahoře zabírá pásmo bodových událostí */
  pointLaneCount: number;
  /** popisky se rezervovaly v rozvržení (false = zhuštěný režim) */
  labelsReserved: boolean;
}

export type MeasureText = (text: string) => number;

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

/**
 * Spočítá rozvržení. Pakuje VŠECHNY předané záznamy (ne jen viditelné), aby
 * se řádky při posunu neměnily; vykreslení si viditelné vybere samo.
 */
export function layoutEvents(
  events: TimelineEvent[],
  view: Viewport,
  categories: Map<string, Category>,
  measureText: MeasureText,
): LayoutResult {
  const measured = events.map((event) => {
    const extent = eventExtent(event);
    const isPoint = event.type !== 'range' || !event.end;
    const rawX1 = xOf(view, extent.from);
    const rawX2 = xOf(view, extent.to);
    const centerX = isPoint ? rawX1 : (rawX1 + rawX2) / 2;
    const x1 = isPoint ? centerX - POINT_RADIUS : rawX1;
    const x2 = isPoint ? centerX + POINT_RADIUS : Math.max(rawX2, rawX1 + 2);
    // Vlnovka v popisku by jen opakovala to, co je vidět z vykreslení.
    const label = event.name;
    const startOpen = event.start.qualifier != null;
    const endOpen = isPoint ? false : (event.end?.qualifier ?? null) != null;
    return {
      event,
      isPoint,
      startOpen,
      endOpen,
      startApprox: event.start.approx,
      endApprox: isPoint ? false : (event.end?.approx ?? false),
      x1,
      x2,
      centerX,
      label,
      labelWidth: measureText(label),
      color: categoryColor(event.categoryId, categories),
    };
  });

  // Místo, které záznam zabírá včetně popisku – používá se pro řádkování
  // i pro rozhodnutí, jestli se popisek vejde vedle sousedů.
  const occupiedRight = new Map<string, number>(
    measured.map((m) => [
      m.event.id,
      labelFitsInside(m) ? m.x2 + openEndSpace(m) : m.x2 + openEndSpace(m) + LABEL_GAP + m.labelWidth,
    ]),
  );

  // Bodové události se řádkují zvlášť a leží nahoře; životy (rozsahy) pod nimi.
  // Míchat je dohromady bylo nepřehledné – události se ztrácely mezi pruhy.
  const bodove = measured.filter((m) => m.isPoint);
  const rozsahy = measured.filter((m) => !m.isPoint);

  const vstupy = (skupina: typeof measured, sPopisky: boolean): LaneInput[] =>
    skupina.map((m) => ({
      id: m.event.id,
      left: m.x1,
      right: sPopisky ? (occupiedRight.get(m.event.id) as number) : m.x2,
    }));

  let packedPoints = packLanes(vstupy(bodove, true), ITEM_GAP);
  let packedRanges = packLanes(vstupy(rozsahy, true), ITEM_GAP);
  let labelsReserved = true;

  if (packedPoints.laneCount + packedRanges.laneCount > MAX_LANES_WITH_LABELS) {
    // zhuštěný režim: místo pro popisky se nerezervuje
    packedPoints = packLanes(vstupy(bodove, false), ITEM_GAP);
    packedRanges = packLanes(vstupy(rozsahy, false), ITEM_GAP);
    labelsReserved = false;
  }

  const bandGap = packedPoints.laneCount > 0 && packedRanges.laneCount > 0 ? BAND_GAP_LANES : 0;
  const rangeOffset = packedPoints.laneCount + bandGap;
  const lanes = new Map<string, number>(packedPoints.lanes);
  for (const [id, lane] of packedRanges.lanes) lanes.set(id, lane + rangeOffset);
  const packed = { lanes, laneCount: rangeOffset + packedRanges.laneCount };

  // Kolik místa má záznam ve svém řádku – vlevo i vpravo od sebe.
  const { nextLeft: nextLeftInLane, previousRight } = computeNeighboursInLane(
    measured.map((m) => ({
      event: m.event,
      x1: m.x1,
      x2: occupiedRight.get(m.event.id) as number,
    })),
    packed.lanes,
  );

  const items: EventGeometry[] = measured.map((m) => {
    const lane = packed.lanes.get(m.event.id) ?? 0;
    const inside = labelFitsInside(m);
    const available = labelsReserved
      ? Number.POSITIVE_INFINITY
      : (nextLeftInLane.get(m.event.id) ?? Number.POSITIVE_INFINITY) - m.x2 - LABEL_GAP - ITEM_GAP;
    let showLabel = m.labelWidth > 0 && (inside || available >= m.labelWidth);

    let labelX: number;
    if (inside) {
      // „Přilepený" popisek: u pruhu delšího než výřez zůstane u okraje plátna.
      // Začíná až za náběhem do ztracena, ať se první písmena neztrácejí.
      const f = fades(m);
      const from = m.x1 + f.start + LABEL_PAD;
      const max = m.x2 - f.end - m.labelWidth - LABEL_PAD;
      labelX = Math.min(Math.max(from, LABEL_PAD), Math.max(max, from));
    } else {
      labelX = m.x2 + openEndSpace(m) + LABEL_GAP;
      // U pravého okraje plátna by popisek utekl mimo. Překlopíme ho doleva od
      // značky, je-li tam volno; jinak popisek skryjeme – uživatel ho uvidí
      // po najetí a v detailu.
      if (showLabel && m.x1 < view.width && labelX + m.labelWidth > view.width - LABEL_PAD) {
        const flipped = m.x1 - LABEL_GAP - m.labelWidth;
        const room = previousRight.get(m.event.id) ?? Number.NEGATIVE_INFINITY;
        if (flipped >= 0 && flipped >= room + ITEM_GAP) labelX = flipped;
        else showLabel = false;
      }
    }

    return {
      event: m.event,
      lane,
      x1: m.x1,
      x2: m.x2,
      centerX: m.centerX,
      color: m.color,
      label: m.label,
      labelWidth: m.labelWidth,
      labelX,
      labelInside: inside,
      showLabel,
      startApprox: m.event.start.approx,
      endApprox: m.event.end?.approx ?? false,
      startOpen: m.startOpen,
      endOpen: m.endOpen,
      isPoint: m.isPoint,
    };
  });

  return {
    items,
    laneCount: packed.laneCount,
    height: packed.laneCount * LANE_HEIGHT,
    pointLaneCount: packedPoints.laneCount,
    labelsReserved,
  };
}

interface MeasuredEvent {
  event: TimelineEvent;
  isPoint: boolean;
  startOpen: boolean;
  endOpen: boolean;
  startApprox: boolean;
  endApprox: boolean;
  x1: number;
  x2: number;
  labelWidth: number;
}

/** Místo, které si vyžádá šipka otevřeného konce (u bodu otevřený začátek). */
function openEndSpace(m: Pick<MeasuredEvent, 'isPoint' | 'startOpen' | 'endOpen'>): number {
  const open = m.isPoint ? m.startOpen : m.endOpen;
  return open ? OPEN_END_WIDTH : 0;
}

/** Náběhy do ztracena na obou stranách pruhu (0, když je hranice jistá). */
function fades(m: Pick<MeasuredEvent, 'isPoint' | 'x1' | 'x2' | 'startApprox' | 'endApprox'>): {
  start: number;
  end: number;
} {
  if (m.isPoint) return { start: 0, end: 0 };
  const width = m.x2 - m.x1;
  return {
    start: m.startApprox ? fadeWidth(width) : 0,
    end: m.endApprox ? fadeWidth(width) : 0,
  };
}

/** Vejde se popisek dovnitř pruhu, mimo náběhy? U bodů nikdy. */
function labelFitsInside(
  m: Pick<MeasuredEvent, 'isPoint' | 'x1' | 'x2' | 'labelWidth' | 'startApprox' | 'endApprox'>,
): boolean {
  if (m.isPoint) return false;
  const f = fades(m);
  return m.x2 - f.end - (m.x1 + f.start) >= m.labelWidth + 2 * LABEL_PAD;
}

/**
 * Pro každý záznam levý okraj následujícího a pravý okraj předchozího záznamu
 * ve stejném řádku – podle toho se rozhoduje o zobrazení a překlopení popisku.
 */
function computeNeighboursInLane(
  measured: Pick<MeasuredEvent, 'event' | 'x1' | 'x2'>[],
  lanes: Map<string, number>,
): { nextLeft: Map<string, number>; previousRight: Map<string, number> } {
  const byLane = new Map<number, { id: string; x1: number; x2: number }[]>();
  for (const m of measured) {
    const lane = lanes.get(m.event.id) ?? 0;
    const list = byLane.get(lane);
    const entry = { id: m.event.id, x1: m.x1, x2: m.x2 };
    if (list) list.push(entry);
    else byLane.set(lane, [entry]);
  }
  const nextLeft = new Map<string, number>();
  const previousRight = new Map<string, number>();
  for (const list of byLane.values()) {
    list.sort((a, b) => a.x1 - b.x1);
    for (let i = 0; i < list.length; i++) {
      nextLeft.set(list[i].id, i + 1 < list.length ? list[i + 1].x1 : Number.POSITIVE_INFINITY);
      previousRight.set(list[i].id, i > 0 ? list[i - 1].x2 : Number.NEGATIVE_INFINITY);
    }
  }
  return { nextLeft, previousRight };
}

/** Zásah kliknutím: vrací nejvýše položený záznam pod bodem. */
export function hitTest(
  layout: LayoutResult,
  x: number,
  y: number,
  scrollTop: number,
  tolerance = 4,
): EventGeometry | null {
  const lane = Math.floor((y + scrollTop) / LANE_HEIGHT);
  if (lane < 0 || lane >= layout.laneCount) return null;
  let best: EventGeometry | null = null;
  for (const item of layout.items) {
    if (item.lane !== lane) continue;
    const labelled = item.showLabel && !item.labelInside;
    // popisek může být vpravo i (u okraje plátna) vlevo od značky
    const left = (labelled ? Math.min(item.x1, item.labelX) : item.x1) - tolerance;
    const right = (labelled ? Math.max(item.x2, item.labelX + item.labelWidth) : item.x2) + tolerance;
    if (x >= left && x <= right) {
      // kratší záznam vyhrává, aby šlo trefit bod ležící na dlouhém pruhu
      if (!best || item.x2 - item.x1 < best.x2 - best.x1) best = item;
    }
  }
  return best;
}
