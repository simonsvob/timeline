/**
 * Export a import dat v jednom JSON souboru s verzí schématu.
 * Parsování je čistá funkce bez závislosti na prohlížeči, aby šlo testovat.
 */

import { cs } from '../i18n/cs';
import { daysInMonth, type Qualifier } from '../lib/time';
import {
  DEFAULT_PLACEMENT,
  EXPORT_SCHEMA_VERSION,
  isPlacement,
  SUPPORTED_IMPORT_VERSIONS,
  type Category,
  type Dataset,
  type ExportFile,
  type Tag,
  type TimelineEvent,
} from './types';

export function buildExport(dataset: Dataset): ExportFile {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    categories: dataset.categories,
    tags: dataset.tags,
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
  qualifier: unknown;
}

function parseTimePoint(raw: RawTimeFields) {
  if (typeof raw.year !== 'number' || !Number.isInteger(raw.year)) return undefined;
  const month = parseOptionalUnit(raw.month, 12);
  if (month === undefined) return undefined;
  const day = parseOptionalUnit(raw.day, 31);
  if (day === undefined) return undefined;
  if (day !== null && month === null) return undefined;
  if (day !== null && month !== null && day > daysInMonth(month)) return undefined;
  const qualifier: Qualifier | null =
    raw.qualifier === 'min' || raw.qualifier === 'after' || raw.qualifier === 'before'
      ? raw.qualifier
      : null;
  return { year: raw.year, month, day, approx: raw.approx === true, qualifier };
}

function parseCategory(raw: unknown): Category | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== 'string' || typeof raw.color !== 'string') return null;
  const optionalYear = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) ? value : null;
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : newId(),
    name: raw.name,
    color: raw.color,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 0,
    fromYear: optionalYear(raw.fromYear),
    toYear: optionalYear(raw.toYear),
  };
}

/**
 * Umístění pro záznamy ze starších exportů. Do verze 3 o něm rozhodovala
 * klíčová slova (`events.tags`), tak se z nich odvodí i teď — první shoda
 * vyhrává. Samotná klíčová slova se do aplikace už nepřenášejí, nic neřídila.
 */
function placementFromKeywords(keywords: string[]) {
  const has = (name: string) => keywords.includes(name);
  if (has('velmoc')) return 'velmoci';
  if (has('vlada-izrael')) return 'izrael';
  if (has('vlada-juda') || has('vlada-12kmenu')) return 'juda';
  if (has('kniha-zahrnuto')) return 'knihy';
  if (has('udalost') || has('kniha') || has('kniha-dokonceno')) return 'udalosti';
  return DEFAULT_PLACEMENT;
}

function parseTag(raw: unknown): Tag | null {
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
    qualifier: startRaw.qualifier,
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
      qualifier: endRaw.qualifier,
    });
    if (!end) return null;
  }

  // Klíčová slova ve verzích 1–4: do aplikace se nedostanou, jen z nich
  // starším záznamům dopočítáme umístění (`tags` se do v4 jmenovala takhle).
  const rawKeywords = Array.isArray(raw.keywords) ? raw.keywords : raw.tags;
  const keywords = Array.isArray(rawKeywords)
    ? rawKeywords.filter((t): t is string => typeof t === 'string')
    : [];
  const optionalText = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
  const optionalNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : newId(),
    name: raw.name,
    type,
    // Starší verze umístění neznaly – dopočítá se z klíčových slov.
    placement: isPlacement(raw.placement) ? raw.placement : placementFromKeywords(keywords),
    tagId: typeof raw.tagId === 'string' && raw.tagId !== '' ? raw.tagId : null,
    start,
    end: end ?? null,
    source: optionalText(raw.source),
    note: optionalText(raw.note),
    placeName: optionalText(raw.placeName),
    lat: optionalNumber(raw.lat),
    lng: optionalNumber(raw.lng),
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
  if (typeof raw.schemaVersion !== 'number' || !SUPPORTED_IMPORT_VERSIONS.includes(raw.schemaVersion)) {
    return { ok: false, error: cs.dataIO.unsupportedVersion(raw.schemaVersion) };
  }
  const schemaVersion = raw.schemaVersion;

  const categories: Category[] = [];
  for (const item of raw.categories) {
    const parsed = parseCategory(item);
    if (!parsed) return { ok: false, error: cs.dataIO.invalidSchema };
    categories.push(parsed);
  }

  // Štítky přibyly až ve verzi 4; starší soubor jich prostě žádné nemá.
  const tags: Tag[] = [];
  for (const item of Array.isArray(raw.tags) ? raw.tags : []) {
    const parsed = parseTag(item);
    if (!parsed) return { ok: false, error: cs.dataIO.invalidSchema };
    tags.push(parsed);
  }

  const events: TimelineEvent[] = [];
  for (const item of raw.events) {
    const parsed = parseEvent(item);
    if (!parsed) return { ok: false, error: cs.dataIO.invalidSchema };
    events.push(parsed);
  }

  // Odkaz na neexistující štítek by porušil cizí klíč – raději ho zahodíme.
  const knownTags = new Set(tags.map((t) => t.id));
  const cleaned = events.map((event) =>
    event.tagId && !knownTags.has(event.tagId) ? { ...event, tagId: null } : event,
  );

  return { ok: true, dataset: { categories, tags, events: cleaned }, schemaVersion };
}
