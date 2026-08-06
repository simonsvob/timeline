/**
 * Validace formuláře záznamu. Čistě funkční, aby šla testovat bez DOM.
 * Pravidla drží stejnou logiku jako CHECK constraints v migraci:
 *   den vyžaduje měsíc, měsíc vyžaduje rok, u rozsahu konec >= začátek,
 *   bod nemá koncová pole, souřadnice buď obě, nebo žádná.
 */

import { cs } from '../i18n/cs';
import type { EventDraft, EventType } from '../data/types';
import {
  compareTimePoints,
  daysInMonth,
  toAstronomicalYear,
  type Era,
  type TimePoint,
} from './time';

/** Nejvyšší povolený rok letopočtu – ochrana proti překlepům typu 20250. */
export const MAX_YEAR = 999_999;

/** Hodnoty tak, jak přicházejí z formulářových polí (vždy řetězce). */
export interface TimeInput {
  year: string;
  era: Era;
  month: string;
  day: string;
  approx: boolean;
}

export interface EventFormInput {
  name: string;
  type: EventType;
  categoryId: string | null;
  start: TimeInput;
  end: TimeInput;
  source: string;
  note: string;
  placeName: string;
  lat: string;
  lng: string;
  tags: string[];
}

export type FieldErrors = Record<string, string>;

export type ValidationResult =
  | { ok: true; value: EventDraft; errors: Record<string, never> }
  | { ok: false; errors: FieldErrors };

export function emptyTimeInput(): TimeInput {
  return { year: '', era: 'bc', month: '', day: '', approx: false };
}

export function emptyEventForm(): EventFormInput {
  return {
    name: '',
    type: 'point',
    categoryId: null,
    start: emptyTimeInput(),
    end: emptyTimeInput(),
    source: '',
    note: '',
    placeName: '',
    lat: '',
    lng: '',
    tags: [],
  };
}

/** Parsuje nepovinné celé číslo. '' -> null, nesmysl -> undefined (chyba). */
function parseOptionalInt(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

function parseOptionalFloat(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function nullIfBlank(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Validace jedné časové skupiny (začátek nebo konec).
 * Chyby zapisuje pod prefix, např. `start.year`.
 */
function validateTimeInput(
  input: TimeInput,
  prefix: string,
  errors: FieldErrors,
  required: boolean,
): TimePoint | null {
  const yearRaw = input.year.trim();

  if (yearRaw === '') {
    if (required) errors[`${prefix}.year`] = cs.validation.yearRequired;
    return null;
  }
  if (!/^\d+$/.test(yearRaw)) {
    errors[`${prefix}.year`] = cs.validation.yearInvalid;
    return null;
  }

  const yearInEra = Number(yearRaw);
  if (yearInEra === 0) {
    // Rok nula neexistuje – uživatel nikdy nezadává astronomickou hodnotu.
    errors[`${prefix}.year`] = cs.validation.yearZero;
    return null;
  }
  if (yearInEra > MAX_YEAR) {
    errors[`${prefix}.year`] = cs.validation.yearTooLarge;
    return null;
  }

  const month = parseOptionalInt(input.month);
  const day = parseOptionalInt(input.day);

  let validMonth: number | null = null;
  if (month === undefined || (month !== null && (month < 1 || month > 12))) {
    errors[`${prefix}.month`] = cs.validation.monthInvalid;
  } else {
    validMonth = month;
  }

  let validDay: number | null = null;
  if (day === undefined || (day !== null && (day < 1 || day > 31))) {
    errors[`${prefix}.day`] = cs.validation.dayInvalid;
  } else if (day !== null && validMonth === null) {
    // den vyžaduje měsíc
    errors[`${prefix}.day`] = cs.validation.dayNeedsMonth;
  } else if (day !== null && validMonth !== null && day > daysInMonth(validMonth)) {
    errors[`${prefix}.day`] = cs.validation.dayNotInMonth(day, validMonth);
  } else {
    validDay = day;
  }

  if (errors[`${prefix}.month`] || errors[`${prefix}.day`]) return null;

  return {
    year: toAstronomicalYear(yearInEra, input.era),
    month: validMonth,
    day: validDay,
    approx: input.approx,
  };
}

export function validateEventForm(input: EventFormInput): ValidationResult {
  const errors: FieldErrors = {};

  const name = input.name.trim();
  if (name === '') errors.name = cs.validation.nameRequired;

  const start = validateTimeInput(input.start, 'start', errors, true);

  let end: TimePoint | null = null;
  if (input.type === 'range') {
    end = validateTimeInput(input.end, 'end', errors, true);
    if (start && end && compareTimePoints(start, end) > 0) {
      errors['end.year'] = cs.validation.endBeforeStart;
    }
  }

  const lat = parseOptionalFloat(input.lat);
  const lng = parseOptionalFloat(input.lng);
  if (lat === undefined || (lat !== null && (lat < -90 || lat > 90))) {
    errors.lat = cs.validation.latInvalid;
  }
  if (lng === undefined || (lng !== null && (lng < -180 || lng > 180))) {
    errors.lng = cs.validation.lngInvalid;
  }
  if (lat !== undefined && lng !== undefined && (lat === null) !== (lng === null)) {
    errors[lat === null ? 'lat' : 'lng'] = cs.validation.latLngPair;
  }

  if (Object.keys(errors).length > 0 || !start) {
    if (!start && !errors['start.year']) errors['start.year'] = cs.validation.yearRequired;
    return { ok: false, errors };
  }

  const tags = Array.from(
    new Set(input.tags.map((t) => t.trim()).filter((t) => t !== '')),
  );

  return {
    ok: true,
    errors: {} as Record<string, never>,
    value: {
      name,
      type: input.type,
      categoryId: input.categoryId,
      start,
      // bod nikdy nemá koncová pole, i kdyby v formuláři něco zbylo
      end: input.type === 'range' ? end : null,
      source: nullIfBlank(input.source),
      note: nullIfBlank(input.note),
      placeName: nullIfBlank(input.placeName),
      lat: (lat as number | null) ?? null,
      lng: (lng as number | null) ?? null,
      tags,
    },
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

export function validateCategoryForm(name: string, color: string): FieldErrors {
  const errors: FieldErrors = {};
  if (name.trim() === '') errors.name = cs.validation.categoryNameRequired;
  if (!isValidHexColor(color)) errors.color = cs.validation.colorInvalid;
  return errors;
}
