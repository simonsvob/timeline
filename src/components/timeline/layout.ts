/**
 * Rozvržení osy „Řeka": jedna centrální vodorovná čára a kolem ní pásma.
 *
 * Pásmo je vodorovný pruh plochy s vlastním řádkováním, definovaný štítky
 * záznamů (`BANDS`). Většina pásem **plave s čárou** — posunou se, když se
 * osa posune svisle. Světové velmoci a vlády králů jsou naopak **připnuté**
 * k horní a dolní hraně plochy a nikam se nehnou; plovoucí obsah jim
 * projíždí pod pruhem. Pásmo bez záznamů (nebo skryté) nezabírá žádné místo.
 *
 * Čistá funkce bez plátna (měření textu se předává), aby šla testovat.
 */

import { packLanes, type LaneInput } from '../../lib/lanes';
import { openDirection, toContinuous } from '../../lib/time';
import { xOf, type Viewport } from '../../lib/viewport';
import { DEFAULT_PLACEMENT, type Placement, type Tag, type TimelineEvent } from '../../data/types';

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

/** Odsazení popisku uvnitř pruhu. */
export const BAR_LABEL_INSET = 13;
export const BAR_LABEL_GAP = 9;
/** Mezera mezi pruhem a popiskem vedle něj. */
export const LABEL_GAP = 10;
/** Mezera mezi sousedy v jednom řádku. */
export const ITEM_GAP = 10;
/** Šipka za otevřenou hranicí. */
export const OPEN_END_WIDTH = 13;
/** Barva záznamu bez štítku – neutrální, ať nepřipomíná žádný druh. */
export const NO_TAG_COLOR = '#9a9384';

/** Svislá mezera mezi dvěma pásmy; vejde se do ní popisek pásma. */
export const BAND_GAP = 26;
/** Odstup pilulkového pásma od čáry — místo pro stopku k uzlu. */
export const POINT_BAND_AXIS_GAP = 73;
/** Odstup pruhového pásma od čáry nad ní. */
export const BAR_BAND_AXIS_GAP_ABOVE = 26;
/** Odstup pruhového pásma od čáry pod ní — musí se vejít popisky let. */
export const BAR_BAND_AXIS_GAP_BELOW = 36;

/** Výška řádku s názvem připnutého pásma. */
export const BAND_CAPTION_HEIGHT = 17;
/** Odsazení připnutého pásu od hrany plochy. */
export const PINNED_EDGE_PADDING = 6;
/** Mezera mezi dvěma připnutými pásmy. */
export const PINNED_BAND_GAP = 8;

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

/**
 * Kam pásmo patří. `above` a `below` plavou s centrální čárou, `top` a
 * `bottom` jsou připnuté k hraně plochy a svisle se nehýbou.
 */
export type BandPlace = 'top' | 'above' | 'below' | 'bottom';
/** `pill` = svislá značka s pilulkou, `bar` = vodorovný pruh, `auto` = podle typu. */
export type BandShape = 'pill' | 'bar' | 'auto';

export interface BandDefinition {
  /** hodnota `placement` záznamu a zároveň klíč do `cs.timeline.bands` */
  id: Placement;
  place: BandPlace;
  shape: BandShape;
  /**
   * Pásmo se neřádkuje — všechno leží na jedné řadě a popisek se vejde jen
   * dovnitř pruhu. Vlády na sebe navazují bez mezer, takže by je řádkování
   * rozházelo do desítek řádků a nešlo by odečíst, kdo vládl souběžně s kým.
   */
  singleLane: boolean;
}

/**
 * Pásma shora dolů, jak leží na obrazovce. Pořadí a chování se mění jen tady;
 * který záznam kam patří, říká jeho `placement`.
 *
 * Velmoci i vlády jsou připnuté k hranám: jsou to souvislé pásy přes celé
 * dějiny a při svislém posunu se hledají hůř než cokoli jiného, tak ať mají
 * pevné místo. Mezi nimi plave to, čeho je hodně a co se řádkuje.
 */
export const BANDS: readonly BandDefinition[] = [
  { id: 'velmoci', place: 'top', shape: 'bar', singleLane: true },
  { id: 'udalosti', place: 'above', shape: 'pill', singleLane: false },
  // --- centrální čára ---
  { id: 'zivoty', place: 'below', shape: 'bar', singleLane: false },
  { id: 'knihy', place: 'below', shape: 'bar', singleLane: false },
  { id: 'ostatni', place: 'below', shape: 'auto', singleLane: false },
  { id: 'izrael', place: 'bottom', shape: 'bar', singleLane: true },
  // Juda je úplně dole; první tři králové nad dvanácti kmeny se s judskými
  // nepřekrývají (předcházejí rozdělení), takže sdílejí řadu.
  { id: 'juda', place: 'bottom', shape: 'bar', singleLane: true },
];

const FALLBACK_BAND = BANDS.find((band) => band.id === DEFAULT_PLACEMENT) ?? BANDS[BANDS.length - 1];

/** Do kterého pásma záznam patří. */
export function bandOf(event: TimelineEvent): BandDefinition {
  return BANDS.find((band) => band.id === event.placement) ?? FALLBACK_BAND;
}

/** Jak se popisek pruhu vejde; degraduje odshora dolů. */
export type LabelMode = 'inside-full' | 'inside-name' | 'outside-full' | 'outside-name' | 'none';

export interface EventGeometry {
  event: TimelineEvent;
  bandId: Placement;
  place: BandPlace;
  /** 0 = řádek nejblíž centrální čáře (u připnutých pásem nejblíž hraně) */
  lane: number;
  /**
   * Svislá poloha středu. U plovoucích pásem vůči centrální čáře (záporná =
   * nad ní), u připnutých vůči hraně plochy (vždy kladná, směrem dovnitř).
   * Na pixely plátna to přepočítá `itemY`.
   */
  centerY: number;
  /** výška tvaru (pilulka nebo pruh) */
  height: number;
  /** kreslí se jako pilulka (jinak jako vodorovný pruh) */
  asPill: boolean;
  /** kreslí se stopka od uzlu na čáře k pilulce */
  stem: boolean;
  /** díl souvislého pásu (pásmo na jedné řadě) — nerozšiřuje se na minimum */
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
  id: Placement;
  place: BandPlace;
  laneCount: number;
  /** vzdálenost od čáry k bližší hraně prvního řádku */
  near: number;
  /** kolik pixelů pásmo zabírá od `near` dál */
  extent: number;
  /**
   * Kam patří název pásma: do mezery na vnitřní straně, aby nepřekrýval
   * žádný pruh. Souřadnice je ve stejné soustavě jako `centerY` položek.
   */
  labelY: number;
  singleLane: boolean;
  labelsReserved: boolean;
}

export interface LayoutResult {
  items: EventGeometry[];
  /** pásma, která mají aspoň jeden záznam */
  bands: BandGeometry[];
  /** kolik pixelů zabírá plovoucí obsah nad čárou */
  heightAbove: number;
  /** kolik pixelů zabírá plovoucí obsah pod čárou */
  heightBelow: number;
  /** kolik pixelů ukusuje připnutý pás u horní hrany */
  pinnedTop: number;
  /** kolik pixelů ukusuje připnutý pás u dolní hrany */
  pinnedBottom: number;
}

/**
 * Volná plocha, do které se osa kreslí. `top` a `bottom` jsou hrany, ke kterým
 * se připínají pevná pásma; `axisY` je poloha centrální čáry mezi nimi.
 */
export interface Frame {
  axisY: number;
  top: number;
  bottom: number;
}

/** Svislá poloha středu položky v pixelech plátna. */
export function itemY(item: EventGeometry, frame: Frame): number {
  if (item.place === 'top') return frame.top + item.centerY;
  if (item.place === 'bottom') return frame.bottom - item.centerY;
  return frame.axisY + item.centerY;
}

/** Svislá poloha názvu pásma v pixelech plátna. */
export function bandLabelY(band: BandGeometry, frame: Frame): number {
  if (band.place === 'top') return frame.top + band.labelY;
  if (band.place === 'bottom') return frame.bottom - band.labelY;
  return frame.axisY + band.labelY;
}

export type MeasureText = (text: string, weight?: 'normal' | 'bold') => number;

/**
 * Rozsah záznamu na spojité ose (pro rozsah i bod).
 *
 * Obě hranice se berou jako **začátek** svého intervalu: rozsah 1107–1037 sahá
 * od začátku roku 1107 do začátku roku 1037, ne do jeho konce. Kdyby zabíral
 * i celý koncový rok, navazující vlády by se o rok překrývaly a bod by seděl
 * uprostřed roku místo na něm.
 */
export function eventExtent(event: TimelineEvent): { from: number; to: number } {
  const from = toContinuous(event.start, 'start');
  if (event.type === 'range' && event.end) {
    return { from, to: toContinuous(event.end, 'start') };
  }
  return { from, to: from };
}

/** Barva záznamu. Bere se ze štítku — kategorie barví jen osu, ne záznamy. */
export function tagColor(tagId: string | null, tags: Map<string, Tag>): string {
  if (!tagId) return NO_TAG_COLOR;
  return tags.get(tagId)?.color ?? NO_TAG_COLOR;
}

interface Measured {
  event: TimelineEvent;
  band: BandDefinition;
  bandIndex: number;
  isPoint: boolean;
  /** jestli se kreslí jako pilulka (jinak pruh) */
  asPill: boolean;
  from: number;
  to: number;
  x1: number;
  x2: number;
  /**
   * Levý a pravý okraj v souřadnici, která NEZÁVISÍ na posunu výřezu
   * (`rok × pxPerYear`, bez `t0`). Řádkuje se v ní, aby posun nemohl
   * přehodit ani jednu položku do jiného řádku.
   */
  packX1: number;
  packX2: number;
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
  // Šířka z `packX*`, ne z `x*`: na posunu nezávislá, takže se popisek
  // uprostřed tažení nepřepne do jiného režimu.
  const usable = m.packX2 - m.packX1 - BAR_LABEL_INSET - 12;
  if (usable >= m.nameWidth + BAR_LABEL_GAP + m.yearsWidth) return 'inside-full';
  if (usable >= m.nameWidth) return 'inside-name';
  if (!reserveOutside) return 'none';
  return 'outside-full';
}

/** Kolik místa si položka nárokuje vpravo od sebe (popisek, šipka). */
function occupiedRightOf(m: Measured, mode: LabelMode): number {
  const openRight = (m.asPill ? m.startOpen : m.endOpen) === 'right';
  const arrow = openRight ? OPEN_END_WIDTH : 0;
  if (m.asPill) return m.packX2 + arrow;
  switch (mode) {
    case 'outside-full':
      return m.packX2 + arrow + LABEL_GAP + m.nameWidth + BAR_LABEL_GAP + m.yearsWidth;
    case 'outside-name':
      return m.packX2 + arrow + LABEL_GAP + m.nameWidth;
    default:
      return m.packX2 + arrow;
  }
}

/** Výška řádku pásma; v `auto` pásmu se vejde i pilulka. */
function laneHeightOf(band: BandDefinition): number {
  return band.shape === 'bar' ? RANGE_LANE_HEIGHT : POINT_LANE_HEIGHT;
}

/** Odstup pásma od čáry, když leží k ní nejblíž. */
function axisGapOf(band: BandDefinition): number {
  if (band.place === 'below') return BAR_BAND_AXIS_GAP_BELOW;
  return band.shape === 'bar' ? BAR_BAND_AXIS_GAP_ABOVE : POINT_BAND_AXIS_GAP;
}

/** Výška tvaru v pásmu. */
function itemHeightOf(band: BandDefinition): number {
  return band.shape === 'bar' ? BAR_HEIGHT : PILL_HEIGHT;
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
  tags: Map<string, Tag>,
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
    // Šířka se počítá z délky v letech, ne z rozdílu pixelů na plátně —
    // ten se s posunem výřezu nepatrně mění a rozhodoval by o řádkování.
    const barHalf = Math.max(((extent.to - extent.from) * view.pxPerYear) / 2, minWidth / 2);
    const name = event.name;
    const years = formatYears(event);
    const nameWidth = measureText(name, 'bold');
    const yearsWidth = measureText(years);
    const pillWidth = PILL_PADDING_X * 2 + nameWidth + (years ? PILL_GAP + yearsWidth : 0);
    // Totéž bez `t0`: souřadnice pro řádkování, na posunu nezávislá.
    const packCenter = isPoint
      ? extent.from * view.pxPerYear
      : ((extent.from + extent.to) / 2) * view.pxPerYear;
    const packHalf = asPill ? pillWidth / 2 : barHalf;

    measured.push({
      event,
      band,
      bandIndex,
      isPoint,
      asPill,
      from: extent.from,
      to: extent.to,
      x1: asPill ? centerX - pillWidth / 2 : centerX - barHalf,
      x2: asPill ? centerX + pillWidth / 2 : centerX + barHalf,
      packX1: packCenter - packHalf,
      packX2: packCenter + packHalf,
      centerX,
      color: tagColor(event.tagId, tags),
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
        left: m.packX1 - (m.startOpen === 'left' ? OPEN_END_WIDTH : 0),
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

  /**
   * Uloží geometrii pásma. `near` je vždy KLADNÁ vzdálenost od výchozí hrany
   * (čára nebo okraj plochy); směr dovnitř plochy nese `sign`. Vrací, kam až
   * pásmo sahá, aby na něj mohlo navázat další.
   */
  const push = (packed: Packed, near: number, sign: 1 | -1, labelNear: number): number => {
    const extent = (packed.laneCount - 1) * laneHeightOf(packed.band) + itemHeightOf(packed.band);
    const geometry: BandGeometry = {
      id: packed.band.id,
      place: packed.band.place,
      laneCount: packed.laneCount,
      near: sign * near,
      extent,
      labelY: sign * labelNear,
      singleLane: packed.band.singleLane,
      labelsReserved: packed.labelsReserved,
    };
    geometryByBand.set(packed.band.id, geometry);
    bands.push(geometry);
    return near + extent;
  };

  // Plovoucí pásma: skládají se od čáry ven. Nad čárou leží první pásmo
  // v seznamu nejvýš, takže se prochází odzadu. Název pásma sedí v mezeře
  // na straně přivrácené k čáře.
  for (const place of ['above', 'below'] as const) {
    const list = packedBands.filter((p) => p.band.place === place);
    const fromAxis = place === 'above' ? [...list].reverse() : list;
    const sign = place === 'above' ? -1 : 1;

    let cursor = 0;
    for (const [index, packed] of fromAxis.entries()) {
      const near = index === 0 ? axisGapOf(packed.band) : cursor + BAND_GAP;
      cursor = push(packed, near, sign, near - BAND_GAP / 2);
    }
  }

  // Připnutá pásma: skládají se od hrany dovnitř, takže `sign` je vždy kladné
  // (`itemY` směr obrátí podle hrany). U dolní hrany je poslední pásmo
  // v seznamu úplně dole, proto se prochází odzadu. Název pásma sedí za
  // pruhem směrem dovnitř plochy — nikdy ho tedy nepřekryje.
  for (const place of ['top', 'bottom'] as const) {
    const list = packedBands.filter((p) => p.band.place === place);
    const fromEdge = place === 'bottom' ? [...list].reverse() : list;

    let cursor = PINNED_EDGE_PADDING;
    for (const packed of fromEdge) {
      const konec = push(packed, cursor, 1, cursor + itemHeightOf(packed.band) + BAND_CAPTION_HEIGHT / 2);
      cursor = konec + BAND_CAPTION_HEIGHT + PINNED_BAND_GAP;
    }
  }

  const floatingEdge = (place: 'above' | 'below') =>
    bands
      .filter((b) => b.place === place)
      .reduce((max, b) => Math.max(max, Math.abs(b.near) + b.extent), 0);

  const pinnedEdge = (place: 'top' | 'bottom') => {
    const list = bands.filter((b) => b.place === place);
    if (list.length === 0) return 0;
    return (
      list.reduce((max, b) => Math.max(max, b.near + b.extent + BAND_CAPTION_HEIGHT), 0) +
      PINNED_EDGE_PADDING
    );
  };

  // --- geometrie jednotlivých záznamů ---------------------------------------

  const items: EventGeometry[] = [];

  for (const packed of packedBands) {
    const geometry = geometryByBand.get(packed.band.id)!;
    // U pásem nad čárou roste `near` nahoru, jinde dolů; znaménko drží `near`.
    const sign = geometry.near < 0 ? -1 : 1;
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
        place: packed.band.place,
        centerY: geometry.near + sign * (lane * laneHeight + height / 2),
        height,
        asPill: m.asPill,
        stem: m.asPill && packed.band.place === 'above',
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
  // Řadí se podle délky v LETECH a při shodě podle id — pixelová šířka se
  // s posunem nepatrně mění a pořadí kreslení by kolísalo.
  const delka = new Map(measured.map((m) => [m.event.id, m.to - m.from]));
  items.sort(
    (a, b) =>
      delka.get(b.event.id)! - delka.get(a.event.id)! || a.event.id.localeCompare(b.event.id),
  );

  return {
    items,
    bands,
    heightAbove: floatingEdge('above'),
    heightBelow: Math.max(AXIS_LABEL_SPACE, floatingEdge('below')),
    pinnedTop: pinnedEdge('top'),
    pinnedBottom: pinnedEdge('bottom'),
  };
}

/** Zásah kliknutím; `x` a `y` jsou souřadnice v pixelech plátna. */
export function hitTest(
  layout: LayoutResult,
  x: number,
  y: number,
  frame: Frame,
): EventGeometry | null {
  let best: EventGeometry | null = null;
  for (const item of layout.items) {
    const half = item.height / 2 + 4;
    if (Math.abs(y - itemY(item, frame)) > half) continue;

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
