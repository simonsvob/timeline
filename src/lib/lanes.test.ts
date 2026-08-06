import { describe, expect, it } from 'vitest';
import { packLanes, type LaneInput } from './lanes';

const item = (id: string, left: number, right: number): LaneInput => ({ id, left, right });

describe('lane packing', () => {
  it('nepřekrývající se záznamy dá do jednoho řádku', () => {
    const { lanes, laneCount } = packLanes(
      [item('a', 0, 100), item('b', 120, 200), item('c', 220, 300)],
      8,
    );
    expect(laneCount).toBe(1);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(0);
    expect(lanes.get('c')).toBe(0);
  });

  it('překrývající se záznamy rozloží do dalších řádků', () => {
    const { lanes, laneCount } = packLanes(
      [item('a', 0, 100), item('b', 50, 150), item('c', 60, 200)],
      8,
    );
    expect(laneCount).toBe(3);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
    expect(lanes.get('c')).toBe(2);
  });

  it('vrací záznam do prvního volného řádku, ne do nového', () => {
    // a a b se překrývají; c začíná až za a -> patří zpět do řádku 0
    const { lanes, laneCount } = packLanes(
      [item('a', 0, 100), item('b', 50, 300), item('c', 150, 200)],
      8,
    );
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
    expect(lanes.get('c')).toBe(0);
    expect(laneCount).toBe(2);
  });

  it('respektuje mezeru mezi záznamy', () => {
    // konec a = 100, začátek b = 104: s mezerou 8 se nevejdou vedle sebe
    expect(packLanes([item('a', 0, 100), item('b', 104, 200)], 8).laneCount).toBe(2);
    expect(packLanes([item('a', 0, 100), item('b', 104, 200)], 2).laneCount).toBe(1);
  });

  it('započítává šířku popisku, která přesahuje pruh', () => {
    // pruh 'a' končí na 100, ale s popiskem zabírá až 260
    const { laneCount } = packLanes([item('a', 0, 260), item('b', 120, 200)], 8);
    expect(laneCount).toBe(2);
  });

  it('nezáleží na pořadí vstupu', () => {
    const input = [item('c', 220, 300), item('a', 0, 100), item('b', 120, 200)];
    const { lanes, laneCount } = packLanes(input, 8);
    expect(laneCount).toBe(1);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(0);
    expect(lanes.get('c')).toBe(0);
  });

  it('nemění vstupní pole', () => {
    const input = [item('c', 220, 300), item('a', 0, 100)];
    const copy = input.map((i) => ({ ...i }));
    packLanes(input, 8);
    expect(input).toEqual(copy);
  });

  it('zvládne mnoho souběžných dlouhých životů (patriarchové)', () => {
    // 20 životů, každý začíná o 10 px později a trvá 1000 px -> všechny se překrývají
    const items = Array.from({ length: 20 }, (_, i) => item(`p${i}`, i * 10, i * 10 + 1000));
    const { lanes, laneCount } = packLanes(items, 8);
    expect(laneCount).toBe(20);
    const used = new Set(lanes.values());
    expect(used.size).toBe(20);
  });

  it('bodové značky se stejnou pozicí jdou do vlastních řádků', () => {
    const items = [item('a', 50, 50), item('b', 50, 50), item('c', 50, 50)];
    const { laneCount } = packLanes(items, 8);
    expect(laneCount).toBe(3);
  });

  it('prázdný vstup dá nula řádků', () => {
    const { lanes, laneCount } = packLanes([], 8);
    expect(laneCount).toBe(0);
    expect(lanes.size).toBe(0);
  });

  it('každá položka dostane právě jeden řádek', () => {
    const items = Array.from({ length: 500 }, (_, i) =>
      item(`e${i}`, (i * 37) % 900, ((i * 37) % 900) + 60),
    );
    const { lanes } = packLanes(items, 8);
    expect(lanes.size).toBe(500);
    for (const it of items) expect(lanes.get(it.id)).toBeGreaterThanOrEqual(0);
  });

  it('v jednom řádku se položky skutečně nepřekrývají', () => {
    const items = Array.from({ length: 200 }, (_, i) => {
      const left = (i * 53) % 1000;
      return item(`e${i}`, left, left + ((i * 17) % 200));
    });
    const gap = 8;
    const { lanes } = packLanes(items, gap);
    const byLane = new Map<number, LaneInput[]>();
    for (const it of items) {
      const lane = lanes.get(it.id)!;
      byLane.set(lane, [...(byLane.get(lane) ?? []), it]);
    }
    for (const laneItems of byLane.values()) {
      const sorted = [...laneItems].sort((a, b) => a.left - b.left);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].left).toBeGreaterThanOrEqual(sorted[i - 1].right + gap);
      }
    }
  });
});
