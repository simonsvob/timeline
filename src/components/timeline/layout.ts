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
/**
 * Nad tento počet řádků se přestane rezervovat místo pro popisky – jinak by
 * při maximálním oddálení s tisíci záznamy osa narostla do nesmyslné výšky.
 * Popisky, které se pak nevejdou, se skryjí (zobrazí se v detailu).
 */
export const MAX_LANES_WITH_LABELS = 60;

export const NO_CATEGORY_COLOR = '#9aa0a6';

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
  isPoint: boolean;
}

export interface LayoutResult {
  items: EventGeometry[];
  laneCount: number;
  height: number;
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
    const label = event.start.approx || (event.end?.approx ?? false) ? `~${event.name}` : event.name;
    return {
      event,
      isPoint,
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
      labelFitsInside(m) ? m.x2 : m.x2 + LABEL_GAP + m.labelWidth,
    ]),
  );

  const withLabels: LaneInput[] = measured.map((m) => ({
    id: m.event.id,
    left: m.x1,
    right: occupiedRight.get(m.event.id) as number,
  }));

  let packed = packLanes(withLabels, ITEM_GAP);
  let labelsReserved = true;

  if (packed.laneCount > MAX_LANES_WITH_LABELS) {
    // zhuštěný režim: místo pro popisky se nerezervuje
    packed = packLanes(
      measured.map((m) => ({ id: m.event.id, left: m.x1, right: m.x2 })),
      ITEM_GAP,
    );
    labelsReserved = false;
  }

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
      const min = LABEL_PAD;
      const max = m.x2 - m.labelWidth - LABEL_PAD;
      labelX = Math.min(Math.max(m.x1 + LABEL_PAD, min), Math.max(max, m.x1 + LABEL_PAD));
    } else {
      labelX = m.x2 + LABEL_GAP;
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
      isPoint: m.isPoint,
    };
  });

  return {
    items,
    laneCount: packed.laneCount,
    height: packed.laneCount * LANE_HEIGHT,
    labelsReserved,
  };
}

interface MeasuredEvent {
  event: TimelineEvent;
  isPoint: boolean;
  x1: number;
  x2: number;
  labelWidth: number;
}

/** Vejde se popisek dovnitř pruhu? U bodů nikdy. */
function labelFitsInside(m: Pick<MeasuredEvent, 'isPoint' | 'x1' | 'x2' | 'labelWidth'>): boolean {
  if (m.isPoint) return false;
  return m.x2 - m.x1 >= m.labelWidth + 2 * LABEL_PAD;
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
