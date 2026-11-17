/**
 * Klíčové události osy (milníky): svislá čára přes celou osu a kulatý odznak
 * s ikonou v liště nahoře, na minimapě tečka.
 *
 * Seznam je natvrdo v kódu – událostí je jen pár a mění se zřídka. Odkazuje
 * na záznamy podle id, takže přejmenování záznamu nevadí; smazaný záznam se
 * prostě přestane ukazovat. Popisky jsou v `cs.timeline.milestones`.
 *
 * Ikony jsou vlastní, ne obrázky z publikací: podmínky jw.org nedovolují
 * jejich obrázky zveřejňovat na jiných webech. Kreslí se stejně jako ikony
 * tlačítek – tah v mřížce 24 × 24, bez výplně.
 */

import type { TimelineEvent } from '../../data/types';
import { eventExtent } from './layout';

export type MilestoneKey =
  | 'stvoreni'
  | 'potopa'
  | 'exodus'
  | 'kral'
  | 'zniceni'
  | 'smrt-jezise'
  | 'kralovstvi';

/** Která událost je klíčová a jakou má ikonu. Pořadí nehraje roli. */
export const MILESTONES: readonly { key: MilestoneKey; eventId: string }[] = [
  // Stvoření Adama = začátek jeho života; samostatný záznam pro stvoření není.
  { key: 'stvoreni', eventId: '694c7127-449d-506d-9a56-adf7c4745208' },
  { key: 'potopa', eventId: '8c8f7d75-4822-5697-a702-79027e318937' },
  { key: 'exodus', eventId: 'ca4dc20d-8fec-51c2-a66e-2c0a88e68151' },
  { key: 'kral', eventId: '43570caf-717e-5d0a-9a0f-23da02134484' },
  { key: 'zniceni', eventId: '8d59ad74-f08c-5e49-83ef-bec9760febd3' },
  { key: 'smrt-jezise', eventId: '531f38fc-607e-5e68-91f6-86265144dff3' },
  { key: 'kralovstvi', eventId: '5c31093f-1b60-5a30-b1d7-a6610c8b02a0' },
];

/** Obrysy ikon v mřížce 24 × 24 (SVG path). */
export const MILESTONE_ICONS: Record<MilestoneKey, string> = {
  // klíček rostliny – počátek života
  stvoreni:
    'M12 21v-9 M12 12C12 7.5 15 5 19.5 5c0 4.5-3 7-7.5 7Z M12 14.5C12 11 9.5 9 6 9c0 3.5 2.5 5.5 6 5.5Z',
  // archa na vlnách
  potopa:
    'M3.5 13.5h17l-2.2 4H5.7Z M8 13.5V10h8v3.5 M10.5 10V7.5h3V10 ' +
    'M2.5 21c1.6 0 1.6-1.2 3.2-1.2S7.3 21 8.9 21s1.6-1.2 3.1-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.1 1.2',
  // rozdělené moře a cesta středem
  exodus: 'M4 3.5c3.5 3 3.5 14 0 17 M20 3.5c-3.5 3-3.5 14 0 17 M12 5v2.5 M12 10.75v2.5 M12 16.5V19',
  // koruna
  kral: 'M4.5 17.5 3.5 8l5 4 3.5-6.5 3.5 6.5 5-4-1 9.5Z M4.5 20.5h15',
  // plamen
  zniceni:
    'M12 21.5a6 6 0 0 0 6-6c0-4-3-5.5-4-9.5-1.6 1.6-2.3 3.3-2.3 5.2-1.3-.8-2-2-2.2-3.4C7.6 9.6 6 12 6 15.5a6 6 0 0 0 6 6Z',
  // pohár a chléb – Památná slavnost
  'smrt-jezise':
    'M4 4h8l-.6 5.2a3.4 3.4 0 0 1-6.8 0Z M8 12.6V18 M5.2 20h5.6 M21 16.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
  // koruna se zářením – Ježíš jako král v nebi
  kralovstvi:
    'M5.5 19l-.8-6.5 4 3 3.3-5.3 3.3 5.3 4-3-.8 6.5Z M5.5 21.5h13 M12 2.5V5 M6.5 4.5l1.3 1.8 M17.5 4.5l-1.3 1.8',
};

/** Lišta s odznaky nad osou. */
export const MILESTONE_STRIP = 50;
export const MILESTONE_RADIUS = 15;
export const MILESTONE_CY = 25;
/** Mezera mezi odznakem a popiskem a nejmenší volno před dalším odznakem. */
export const MILESTONE_LABEL_GAP = 7;

export interface MilestonePlace {
  key: MilestoneKey;
  event: TimelineEvent;
  /** čas na spojité ose */
  t: number;
}

/** Klíčové události, které v datech opravdu jsou (smazaný záznam se nekreslí). */
export function milestonePlaces(events: readonly TimelineEvent[]): MilestonePlace[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const places: MilestonePlace[] = [];
  for (const { key, eventId } of MILESTONES) {
    const event = byId.get(eventId);
    if (event) places.push({ key, event, t: eventExtent(event).from });
  }
  return places.sort((a, b) => a.t - b.t);
}

/**
 * Které popisky se vejdou. Odznaky se ukazují vždycky; popisek jen tehdy,
 * když nezajede do dalšího odznaku – při oddálení by se slily do jedné šmouhy
 * a přečíst se dá i z detailu po klepnutí.
 */
export function fitMilestoneLabels(xs: readonly number[], labelWidths: readonly number[]): boolean[] {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const fits = xs.map(() => false);
  order.forEach((index, position) => {
    const next = order[position + 1];
    const end = xs[index] + MILESTONE_RADIUS + MILESTONE_LABEL_GAP + labelWidths[index];
    const limit = next === undefined ? Infinity : xs[next] - MILESTONE_RADIUS - MILESTONE_LABEL_GAP;
    fits[index] = end <= limit;
  });
  return fits;
}
