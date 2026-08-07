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
}

export type CategoryDraft = Omit<Category, 'id'>;

export interface TimelineEvent {
  id: string;
  name: string;
  type: EventType;
  categoryId: string | null;
  start: TimePoint;
  /** null u typu 'point' */
  end: TimePoint | null;
  source: string | null;
  note: string | null;
  /** Připraveno pro budoucí mapový pohled, teď se jen ukládá a zobrazuje. */
  placeName: string | null;
  lat: number | null;
  lng: number | null;
  /** Připraveno pro budoucí pohledy podle období/postav. */
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type EventDraft = Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>;

/** Data v jednom balíku – to, co drží aplikace v paměti. */
export interface Dataset {
  categories: Category[];
  events: TimelineEvent[];
}

/**
 * Verze 2 přidala otevřenou hranici (`qualifier`) u časových údajů.
 * Import umí načíst i verzi 1 – chybějící kvalifikátor je prostě null.
 */
export const EXPORT_SCHEMA_VERSION = 2;
export const SUPPORTED_IMPORT_VERSIONS = [1, 2];

export interface ExportFile {
  schemaVersion: number;
  exportedAt: string;
  categories: Category[];
  events: TimelineEvent[];
}
