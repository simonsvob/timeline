/**
 * Export a import dat v jednom JSON souboru s verzí schématu.
 * Parsování je čistá funkce bez závislosti na prohlížeči, aby šlo testovat.
 */

import { cs } from '../i18n/cs';
import { daysInMonth } from '../lib/time';
import { EXPORT_SCHEMA_VERSION, type Category, type Dataset, type ExportFile, type TimelineEvent } from './types';

export function buildExport(dataset: Dataset): ExportFile {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    categories: dataset.categories,
    events: dataset.events,
  };
}

export function serializeExport(dataset: Dataset): string {
  return JSON.stringify(buildExport(dataset), null, 2);
}

export function exportFileName(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `${cs.dataIO.exportFileName}-${stamp}.json`;
}

export type ParseResult =
  | { ok: true; dataset: Dataset; schemaVersion: number }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // záloha pro prostředí bez WebCrypto (např. testy)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseOptionalUnit(value: unknown, max: number): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) return undefined;
  return value;
}

interface RawTimeFields {
  year: unknown;
  month: unknown;
  day: unknown;
  approx: unknown;
}

function parseTimePoint(raw: RawTimeFields) {
  if (typeof raw.year !== 'number' || !Number.isInteger(raw.year)) return undefined;
  const month = parseOptionalUnit(raw.month, 12);
  if (month === undefined) return undefined;
  const day = parseOptionalUnit(raw.day, 31);
  if (day === undefined) return undefined;
  if (day !== null && month === null) return undefined;
  if (day !== null && month !== null && day > daysInMonth(month)) return undefined;
  return { year: raw.year, month, day, approx: raw.approx === true };
}

function parseCategory(raw: unknown): Category | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== 'string' || typeof raw.color !== 'string') return null;
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : newId(),
    name: raw.name,
    color: raw.color,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 0,
  };
}

function parseEvent(raw: unknown): TimelineEvent | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== 'string') return null;
  const type = raw.type === 'range' ? 'range' : raw.type === 'point' ? 'point' : null;
  if (!type) return null;

  const startRaw = isRecord(raw.start) ? raw.start : null;
  if (!startRaw) return null;
  const start = parseTimePoint({
    year: startRaw.year,
    month: startRaw.month,
    day: startRaw.day,
    approx: startRaw.approx,
  });
  if (!start) return null;

  let end: ReturnType<typeof parseTimePoint> = undefined;
  if (type === 'range') {
    const endRaw = isRecord(raw.end) ? raw.end : null;
    if (!endRaw) return null;
    end = parseTimePoint({
      year: endRaw.year,
      month: endRaw.month,
      day: endRaw.day,
      approx: endRaw.approx,
    });
    if (!end) return null;
  }

  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [];
  const optionalText = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
  const optionalNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : newId(),
    name: raw.name,
    type,
    categoryId: typeof raw.categoryId === 'string' && raw.categoryId !== '' ? raw.categoryId : null,
    start,
    end: end ?? null,
    source: optionalText(raw.source),
    note: optionalText(raw.note),
    placeName: optionalText(raw.placeName),
    lat: optionalNumber(raw.lat),
    lng: optionalNumber(raw.lng),
    tags,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
}

/** Rozparsuje a zvaliduje obsah exportovaného souboru. */
export function parseImport(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: cs.dataIO.invalidJson };
  }

  if (!isRecord(raw) || !Array.isArray(raw.categories) || !Array.isArray(raw.events)) {
    return { ok: false, error: cs.dataIO.invalidSchema };
  }
  if (raw.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: cs.dataIO.unsupportedVersion(raw.schemaVersion) };
  }

  const categories: Category[] = [];
  for (const item of raw.categories) {
    const parsed = parseCategory(item);
    if (!parsed) return { ok: false, error: cs.dataIO.invalidSchema };
    categories.push(parsed);
  }

  const events: TimelineEvent[] = [];
  for (const item of raw.events) {
    const parsed = parseEvent(item);
    if (!parsed) return { ok: false, error: cs.dataIO.invalidSchema };
    events.push(parsed);
  }

  // Odkaz na neexistující kategorii by porušil cizí klíč – raději ho zahodíme.
  const knownCategories = new Set(categories.map((c) => c.id));
  const cleaned = events.map((event) =>
    event.categoryId && !knownCategories.has(event.categoryId)
      ? { ...event, categoryId: null }
      : event,
  );

  return { ok: true, dataset: { categories, events: cleaned }, schemaVersion: EXPORT_SCHEMA_VERSION };
}
