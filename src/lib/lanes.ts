/**
 * Automatické řádkování (lane packing).
 *
 * Greedy algoritmus: záznamy seřazené podle začátku se skládají do prvního
 * volného řádku tak, aby se nepřekrývaly – včetně šířky popisku, která se do
 * obsazeného místa započítává (proto se pracuje v pixelech, ne v letech).
 * Zvládá mnoho souběžných životů (patriarchové se překrývají po stovkách let).
 */

export interface LaneInput {
  id: string;
  /** levý okraj obsazeného místa v pixelech (včetně popisku) */
  left: number;
  /** pravý okraj obsazeného místa v pixelech (včetně popisku) */
  right: number;
}

export interface LaneResult {
  /** id -> index řádku (0 = nejvyšší) */
  lanes: Map<string, number>;
  laneCount: number;
}

export const DEFAULT_LANE_GAP = 8;

/**
 * Rozdělí položky do řádků. Vstup se neupravuje (řadí se kopie).
 * Položky se stejným začátkem si zachovají vzájemné pořadí (stabilní řazení).
 */
export function packLanes(items: LaneInput[], gap: number = DEFAULT_LANE_GAP): LaneResult {
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.left - b.item.left || a.index - b.index);

  /** pravý okraj posledního záznamu v každém řádku */
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();

  for (const { item } of sorted) {
    const right = Math.max(item.right, item.left);
    let placed = false;
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (laneEnds[lane] + gap <= item.left) {
        laneEnds[lane] = right;
        lanes.set(item.id, lane);
        placed = true;
        break;
      }
    }
    if (!placed) {
      laneEnds.push(right);
      lanes.set(item.id, laneEnds.length - 1);
    }
  }

  return { lanes, laneCount: laneEnds.length };
}
