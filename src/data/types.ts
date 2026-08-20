/**
 * Doménové typy aplikace. Datová vrstva (repository) je mapuje z/na řádky
 * Supabase; vizualizace se o tvar databáze nezajímá. Díky tomu půjde později
 * přidat mapový pohled nebo pohled podle postav bez zásahu do osy.
 */

import type { TimePoint } from '../lib/time';

export type EventType = 'point' | 'range';

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  /**
   * Nepovinný rozsah období (astronomické roky). Kategorie s rozsahem se
   * chová jako časové období: barví centrální čáru osy a minimapu.
   * Bez rozsahu je to jen barevný štítek s filtrem, jako dřív.
   */
  fromYear: number | null;
  toYear: number | null;
}

export type CategoryDraft = Omit<Category, 'id'>;

/**
 * Štítek = druh záznamu. Nese barvu a záznam má nejvýš jeden — proto je
 * barva vždy jednoznačná. Zakládá se v aplikaci, kód o konkrétních štítcích
 * nic neví.
 */
export interface Tag {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export type TagDraft = Omit<Tag, 'id'>;

/**
 * Kam na osu záznam patří. Pevný seznam, protože ke každé hodnotě patří i kus
 * vykreslení (připnutý pás, jedna řada, tvar) — viz `BANDS` v layoutu.
 */
export type Placement = 'velmoci' | 'udalosti' | 'zivoty' | 'knihy' | 'izrael' | 'juda';

export const PLACEMENTS: readonly Placement[] = [
  'velmoci',
  'udalosti',
  'zivoty',
  'knihy',
  'izrael',
  'juda',
];

/**
 * Kam spadne záznam s neznámým umístěním (starší data, cizí import).
 * Záchytné pásmo „Ostatní" bylo zrušené — padaly do něj jen rozsahy, které
 * patří k ostatním rozsahům pod osou, a jako pásmo navíc jen ubíralo místo.
 */
export const DEFAULT_PLACEMENT: Placement = 'zivoty';

/**
 * Výchozí umístění v prázdném formuláři. Nový záznam začíná jako bod, a bod
 * patří nad osu — v pásmu rozsahů by se z něj stal pruh nejmenší šířky.
 */
export const NEW_EVENT_PLACEMENT: Placement = 'udalosti';

export function isPlacement(value: unknown): value is Placement {
  return typeof value === 'string' && (PLACEMENTS as readonly string[]).includes(value);
}

export interface TimelineEvent {
  id: string;
  name: string;
  type: EventType;
  /** kam na osu patří */
  placement: Placement;
  /** druh záznamu; nese barvu, nejvýš jeden */
  tagId: string | null;
  start: TimePoint;
  /** null u typu 'point' */
  end: TimePoint | null;
  source: string | null;
  note: string | null;
  /** Připraveno pro budoucí mapový pohled, teď se jen ukládá a zobrazuje. */
  placeName: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
}

export type EventDraft = Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>;

/** Data v jednom balíku – to, co drží aplikace v paměti. */
export interface Dataset {
  categories: Category[];
  tags: Tag[];
  events: TimelineEvent[];
}

/**
 * Verze 2 přidala otevřenou hranici (`qualifier`) u časových údajů,
 * verze 3 rozsah období u kategorií, verze 4 štítky s barvou a umístění
 * záznamu, verze 5 zahodila klíčová slova a pásmo „Ostatní". Import umí
 * načíst i starší verze – chybějící pole se dopočítají nebo zůstanou prázdná,
 * přebytečná se zahodí.
 */
export const EXPORT_SCHEMA_VERSION = 5;
export const SUPPORTED_IMPORT_VERSIONS = [1, 2, 3, 4, 5];

export interface ExportFile {
  schemaVersion: number;
  exportedAt: string;
  categories: Category[];
  tags: Tag[];
  events: TimelineEvent[];
}
