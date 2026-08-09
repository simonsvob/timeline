/**
 * Rozvržení osy „Řeka": jedna centrální vodorovná čára a kolem ní pásma.
 *
 * Pásmo je vodorovný pruh plochy s vlastním řádkováním, definovaný štítky
 * záznamů (`BANDS`). Nad čárou leží velmoci a bodové události, pod ní životy
 * a vlády. Pásmo bez záznamů (nebo skryté) nezabírá žádné svislé místo.
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

/** Výška řádku pilulek. */
export const POINT_LANE_HEIGHT = 56;
export const PILL_HEIGHT = 34;
export const PILL_PADDING_X = 14;
/** Mezera mezi jménem a rokem v pilulce. */
export const PILL_GAP = 7;
export const NODE_RADIUS = 6.5;

/** Výška řádku pruhů. */
export const RANGE_LANE_HEIGHT = 44;
export const BAR_HEIGHT = 28;
/**
 * Zaoblení rohů pruhu. Menší než polovina výšky, takže pruh je spíš obdélník
 * s kulatými rohy — díky tomu se u krátkých pruhů nemusí poloměr srážet
 * a nevzniknou z nich kroužky.
 */
export const BAR_RADIUS = 10;
/**
 * Nejmenší šířka pruhu. Při velkém oddálení by z krátkých životů zbyly
 * nitky; místo toho zůstanou čitelným tvarem přes celou výšku řádku.
 * Rozšiřuje se symetricky, aby pruh zůstal na svém místě.
 */
export const MIN_BAR_WIDTH = 20;
/**
 * Nejmenší šířka pruhu v pásmu na jedné řadě. Tam pruhy tvoří souvislý pás,
 * takže široké minimum by krátké vlády roztáhlo přes sousedy.
 */
export const MIN_SEGMENT_WIDTH = 2;
/**
 * Zaoblení pruhu v pásmu na jedné řadě. Malé, aby navazující vlády četly jako
 * díly jednoho pásu, ne jako řetěz samostatných pilulek.
 */
export const SEGMENT_BAR_RADIUS = 3;
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

/** Svislá mezera mezi dvěma pásmy; vejde se do ní popisek pásma. */
export const BAND_GAP = 26;
/** Odstup pilulkového pásma od čáry — místo pro stopku k uzlu. */
export const POINT_BAND_AXIS_GAP = 73;
/** Odstup pruhového pásma od čáry nad ní. */
export const BAR_BAND_AXIS_GAP_ABOVE = 26;
/** Odstup pruhového pásma od čáry pod ní — musí se vejít popisky let. */
export const BAR_BAND_AXIS_GAP_BELOW = 36;

/**
 * Nad tento počet řádků v pásmu se přestane rezervovat místo pro popisky –
 * jinak by osa při maximálním oddálení narostla do nesmyslné výšky.
 * Vyhodnocuje se za každé pásmo zvlášť.
 */
export const MAX_LANES_WITH_LABELS = 40;

/**
 * Kolik řádků pilulek smí stát nad čárou. Co se nevejde, zůstane jen uzlem na
 * čáře a popisek se ukáže po najetí nebo v detailu; jinak by při oddálení
 * pilulky vytlačily osu mimo obrazovku.
 */
export const MAX_POINT_LANES = 5;

// --- pásma ------------------------------------------------------------------

export type BandSide = 'above' | 'below';
/** `pill` = svislá značka s pilulkou, `bar` = vodorovný pruh, `auto` = podle typu. */
export type BandShape = 'pill' | 'bar' | 'auto';

export interface BandDefinition {
  /** klíč do `cs.timeline.bands` */
  id: string;
  /** stačí jeden ze štítků; prázdné pole = zbytek bez známého štítku */
  tags: string[];
  side: BandSide;
  shape: BandShape;
  /**
   * Pásmo se neřádkuje — všechno leží na jedné řadě a popisek se vejde jen
   * dovnitř pruhu. Vlády na sebe navazují bez mezer, takže by je řádkování
   * rozházelo do desítek řádků a nešlo by odečíst, kdo vládl souběžně s kým.
   */
  singleLane: boolean;
}

/**
 * Pásma shora dolů, jak leží na obrazovce. Pořadí a štítky se mění jen tady —
 * vykreslení o konkrétních pásmech nic neví.
 */
export const BANDS: readonly BandDefinition[] = [
  { id: 'velmoci', tags: ['velmoc'], side: 'above', shape: 'bar', singleLane: true },
  { id: 'udalosti', tags: ['udalost', 'kniha'], side: 'above', shape: 'pill', singleLane: false },
  // --- centrální čára ---
  { id: 'zivoty', tags: ['zivot'], side: 'below', shape: 'bar', singleLane: false },
  // 12 kmenů se s Judou nepřekrývá (předchází rozdělení), proto sdílí řadu.
  { id: 'juda', tags: ['vlada-juda', 'vlada-12kmenu'], side: 'below', shape: 'bar', singleLane: true },
  { id: 'izrael', tags: ['vlada-izrael'], side: 'below', shape: 'bar', singleLane: true },
  { id: 'ostatni', tags: [], side: 'below', shape: 'auto', singleLane: false },
];

const FALLBACK_BAND = BANDS.find((band) => band.tags.length === 0) ?? BANDS[BANDS.length - 1];

/** Do kterého pásma záznam patří. První pásmo se shodou štítků vyhrává. */
export function bandOf(event: TimelineEvent): BandDefinition {
  for (const band of BANDS) {
    if (band.tags.length === 0) continue;
    if (band.tags.some((tag) => event.tags.includes(tag))) return band;
  }
  return FALLBACK_BAND;
}

/** Jak se popisek pruhu vejde; degraduje odshora dolů. */
export type LabelMode = 'inside-full' | 'inside-name' | 'outside-full' | 'outside-name' | 'none';

export interface EventGeometry {
  event: TimelineEvent;
  bandId: string;
  /** 0 = řádek nejblíž centrální čáře */
  lane: number;
  /** svislá poloha středu vůči čáře; záporná = nad čárou */
  centerY: number;
  /** výška tvaru (pilulka nebo pruh) */
  height: number;
  /** kreslí se jako pilulka (jinak jako vodorovný pruh) */
  asPill: boolean;
  /** kreslí se stopka od uzlu na čáře k pilulce */
  stem: boolean;
  /** díl souvislého pásu (pásmo na jedné řadě) — menší zaoblení */
  segment: boolean;
  /**
   * Střídavý odstín v pásmu na jedné řadě. Navazující vlády se dotýkají,
   * takže se sousedé odliší odstínem, ne mezerou.
   */
  shade: 0 | 1;
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

export interface BandGeometry {
  id: string;
  side: BandSide;
  laneCount: number;
  /** vzdálenost od čáry k bližší hraně prvního řádku */
  near: number;
  /** kolik pixelů pásmo zabírá od `near` dál */
  extent: number;
  /**
   * Kam patří popisek pásma: do mezery na straně přivrácené k čáře, aby
   * nepřekrýval žádný pruh. Záporné hodnoty jsou nad čárou.
   */
  labelY: number;
  singleLane: boolean;
  labelsReserved: boolean;
}

export interface LayoutResult {
  items: EventGeometry[];
  /** pásma, která mají aspoň jeden záznam, v pořadí od čáry ven */
  bands: BandGeometry[];
  /** kolik pixelů zabírá obsah nad čárou */
  heightAbove: number;
  /** kolik pixelů zabírá obsah pod čárou */
  heightBelow: number;
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

interface Measured {
  event: TimelineEvent;
  band: BandDefinition;
  bandIndex: number;
  isPoint: boolean;
  /** jestli se kreslí jako pilulka (jinak pruh) */
  asPill: boolean;
  from: number;
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
}

/** Vybere nejbohatší popisek, který se do pruhu (nebo vedle něj) vejde. */
function chooseLabelMode(m: Measured, reserveOutside: boolean): LabelMode {
  if (m.asPill) return 'inside-full';
  const usable = m.x2 - m.x1 - BAR_LABEL_INSET - 12;
  if (usable >= m.nameWidth + BAR_LABEL_GAP + m.yearsWidth) return 'inside-full';
  if (usable >= m.nameWidth) return 'inside-name';
  if (!reserveOutside) return 'none';
  return 'outside-full';
}

/** Kolik místa si položka nárokuje vpravo od sebe (popisek, šipka). */
function occupiedRightOf(m: Measured, mode: LabelMode): number {
  const openRight = (m.asPill ? m.startOpen : m.endOpen) === 'right';
  const arrow = openRight ? OPEN_END_WIDTH : 0;
  if (m.asPill) return m.x2 + arrow;
  switch (mode) {
    case 'outside-full':
      return m.x2 + arrow + LABEL_GAP + m.nameWidth + BAR_LABEL_GAP + m.yearsWidth;
    case 'outside-name':
      return m.x2 + arrow + LABEL_GAP + m.nameWidth;
    default:
      return m.x2 + arrow;
  }
}

/** Výška řádku pásma; v `auto` pásmu se vejde i pilulka. */
function laneHeightOf(band: BandDefinition): number {
  return band.shape === 'bar' ? RANGE_LANE_HEIGHT : POINT_LANE_HEIGHT;
}

/** Odstup pásma od čáry, když leží k ní nejblíž. */
function axisGapOf(band: BandDefinition): number {
  if (band.side === 'below') return BAR_BAND_AXIS_GAP_BELOW;
  return band.shape === 'bar' ? BAR_BAND_AXIS_GAP_ABOVE : POINT_BAND_AXIS_GAP;
}

/**
 * Spočítá rozvržení. Pakuje VŠECHNY předané záznamy (ne jen viditelné), aby
 * se řádky při posunu neměnily; vykreslení si viditelné vybere samo.
 *
 * `hiddenBands` vynechá celá pásma — skryté pásmo nezabírá svislé místo.
 */
export function layoutEvents(
  events: TimelineEvent[],
  view: Viewport,
  categories: Map<string, Category>,
  measureText: MeasureText,
  formatYears: (event: TimelineEvent) => string,
  hiddenBands?: ReadonlySet<string>,
): LayoutResult {
  const measured: Measured[] = [];

  for (const event of events) {
    const band = bandOf(event);
    if (hiddenBands?.has(band.id)) continue;
    const bandIndex = BANDS.indexOf(band);

    const extent = eventExtent(event);
    const isPoint = event.type !== 'range' || !event.end;
    // Pásmo rozhoduje o tvaru; `auto` nechá rozhodnout typ záznamu.
    const asPill = band.shape === 'pill' || (band.shape === 'auto' && isPoint);
    const rawX1 = xOf(view, extent.from);
    const rawX2 = xOf(view, extent.to);
    const centerX = isPoint ? rawX1 : (rawX1 + rawX2) / 2;
    const minWidth = band.singleLane ? MIN_SEGMENT_WIDTH : MIN_BAR_WIDTH;
    const barHalf = Math.max((rawX2 - rawX1) / 2, minWidth / 2);
    const name = event.name;
    const years = formatYears(event);
    const nameWidth = measureText(name, 'bold');
    const yearsWidth = measureText(years);
    const pillWidth = PILL_PADDING_X * 2 + nameWidth + (years ? PILL_GAP + yearsWidth : 0);

    measured.push({
      event,
      band,
      bandIndex,
      isPoint,
      asPill,
      from: extent.from,
      x1: asPill ? centerX - pillWidth / 2 : centerX - barHalf,
      x2: asPill ? centerX + pillWidth / 2 : centerX + barHalf,
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
    });
  }

  // --- řádkování za každé pásmo zvlášť --------------------------------------

  interface Packed {
    band: BandDefinition;
    members: Measured[];
    lanes: Map<string, number>;
    laneCount: number;
    labelsReserved: boolean;
    /** id -> střídavý odstín (jen u pásem na jedné řadě) */
    shades: Map<string, 0 | 1>;
    /** id bodů, které se nevešly do povoleného počtu řádků */
    pillHidden: Set<string>;
  }

  const packedBands: Packed[] = [];

  for (const band of BANDS) {
    const members = measured.filter((m) => m.band === band);
    if (members.length === 0) continue;

    const shades = new Map<string, 0 | 1>();
    const pillHidden = new Set<string>();

    if (band.singleLane) {
      // Bez řádkování: pořadí podle začátku určuje jen střídání odstínu.
      const order = [...members].sort((a, b) => a.from - b.from);
      order.forEach((m, index) => shades.set(m.event.id, (index % 2) as 0 | 1));
      packedBands.push({
        band,
        members,
        lanes: new Map(members.map((m) => [m.event.id, 0])),
        laneCount: 1,
        labelsReserved: false,
        shades,
        pillHidden,
      });
      continue;
    }

    const pack = (reserveOutside: boolean) => {
      const inputs: LaneInput[] = members.map((m) => ({
        id: m.event.id,
        left: m.x1 - (m.startOpen === 'left' ? OPEN_END_WIDTH : 0),
        right: occupiedRightOf(m, chooseLabelMode(m, reserveOutside)),
      }));
      return packLanes(inputs, ITEM_GAP);
    };

    let packed = pack(true);
    let labelsReserved = true;
    if (packed.laneCount > MAX_LANES_WITH_LABELS) {
      packed = pack(false);
      labelsReserved = false;
    }

    let laneCount = packed.laneCount;
    if (band.shape === 'pill') {
      // Pilulky nad limit přijdou o popisek a spadnou zpátky na čáru.
      for (const [id, lane] of packed.lanes) {
        if (lane >= MAX_POINT_LANES) pillHidden.add(id);
      }
      laneCount = Math.min(laneCount, MAX_POINT_LANES);
    }

    packedBands.push({
      band,
      members,
      lanes: packed.lanes,
      laneCount,
      labelsReserved,
      shades,
      pillHidden,
    });
  }

  // --- svislé skládání pásem ------------------------------------------------

  const geometryByBand = new Map<string, BandGeometry>();
  const bands: BandGeometry[] = [];

  for (const side of ['above', 'below'] as const) {
    // Nad čárou leží první pásmo v seznamu nejvýš, takže se skládá odzadu.
    const list = packedBands.filter((p) => p.band.side === side);
    const fromAxis = side === 'above' ? [...list].reverse() : list;

    let cursor = 0;
    for (const [index, packed] of fromAxis.entries()) {
      const laneHeight = laneHeightOf(packed.band);
      const itemHeight = packed.band.shape === 'bar' ? BAR_HEIGHT : PILL_HEIGHT;
      const near = index === 0 ? axisGapOf(packed.band) : cursor + BAND_GAP;
      const extent = (packed.laneCount - 1) * laneHeight + itemHeight;
      const sign = side === 'above' ? -1 : 1;

      const geometry: BandGeometry = {
        id: packed.band.id,
        side,
        laneCount: packed.laneCount,
        near,
        extent,
        labelY: sign * (near - BAND_GAP / 2),
        singleLane: packed.band.singleLane,
        labelsReserved: packed.labelsReserved,
      };
      geometryByBand.set(packed.band.id, geometry);
      bands.push(geometry);
      cursor = near + extent;
    }
  }

  const farEdge = (side: BandSide) =>
    bands
      .filter((b) => b.side === side)
      .reduce((max, b) => Math.max(max, b.near + b.extent), 0);

  // --- geometrie jednotlivých záznamů ---------------------------------------

  const items: EventGeometry[] = [];

  for (const packed of packedBands) {
    const geometry = geometryByBand.get(packed.band.id)!;
    const sign = geometry.side === 'above' ? -1 : 1;
    const laneHeight = laneHeightOf(packed.band);

    for (const m of packed.members) {
      const bezPilulky = packed.pillHidden.has(m.event.id);
      const lane = bezPilulky ? 0 : (packed.lanes.get(m.event.id) ?? 0);
      const mode: LabelMode = bezPilulky ? 'none' : chooseLabelMode(m, packed.labelsReserved);
      const height = m.asPill ? PILL_HEIGHT : BAR_HEIGHT;

      let labelX: number;
      if (m.asPill) {
        labelX = m.x1 + PILL_PADDING_X;
      } else if (mode === 'inside-full' || mode === 'inside-name') {
        // „Přilepený" popisek: u pruhu delšího než výřez zůstane u okraje plátna.
        const from = m.x1 + BAR_LABEL_INSET;
        const width =
          mode === 'inside-full' ? m.nameWidth + BAR_LABEL_GAP + m.yearsWidth : m.nameWidth;
        const max = m.x2 - width - 12;
        labelX = Math.min(Math.max(from, BAR_LABEL_INSET), Math.max(max, from));
      } else {
        labelX = m.x2 + (m.endOpen === 'right' ? OPEN_END_WIDTH : 0) + LABEL_GAP;
      }

      items.push({
        event: m.event,
        bandId: packed.band.id,
        lane,
        centerY: sign * (geometry.near + lane * laneHeight + height / 2),
        height,
        asPill: m.asPill,
        stem: m.asPill && geometry.side === 'above',
        segment: packed.band.singleLane && !m.asPill,
        shade: packed.shades.get(m.event.id) ?? 0,
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
      });
    }
  }

  // Širší pruhy se kreslí dřív, aby krátké vlády zůstaly nahoře a byly vidět.
  items.sort((a, b) => b.x2 - b.x1 - (a.x2 - a.x1));

  return {
    items,
    bands,
    heightAbove: farEdge('above'),
    heightBelow: Math.max(AXIS_LABEL_SPACE, farEdge('below')),
  };
}

/**
 * Zásah kliknutím. `y` je vzdálenost od centrální čáry (záporná = nad ní).
 */
export function hitTest(layout: LayoutResult, x: number, yFromAxis: number): EventGeometry | null {
  let best: EventGeometry | null = null;
  for (const item of layout.items) {
    const half = item.height / 2 + 4;
    if (Math.abs(yFromAxis - item.centerY) > half) continue;

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
