/**
 * Datová vrstva: jediné místo, které zná tvar tabulek Supabase.
 * Vizualizace i formuláře pracují výhradně s doménovými typy z ./types,
 * aby šlo později přidat mapový pohled nebo pohled podle postav bez zásahu
 * do osy.
 */

import { cs } from '../i18n/cs';
import { requireSupabase } from '../lib/supabase';
import type { Category, CategoryDraft, Dataset, EventDraft, TimelineEvent } from './types';

/**
 * Strop pro čtení dat. Bez něj by výpadek sítě nechal aplikaci viset na
 * načítacím kolečku – Supabase klient čeká na odpověď libovolně dlouho.
 */
export const READ_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Řádky databáze
// ---------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  from_year: number | null;
  to_year: number | null;
}

interface EventRow {
  id: string;
  name: string;
  type: 'point' | 'range';
  category_id: string | null;
  start_year: number;
  start_month: number | null;
  start_day: number | null;
  start_approx: boolean;
  start_qualifier: 'min' | 'after' | 'before' | null;
  end_year: number | null;
  end_month: number | null;
  end_day: number | null;
  end_approx: boolean;
  end_qualifier: 'min' | 'after' | 'before' | null;
  source: string | null;
  note: string | null;
  place_name: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

const EVENT_COLUMNS =
  'id,name,type,category_id,start_year,start_month,start_day,start_approx,start_qualifier,' +
  'end_year,end_month,end_day,end_approx,end_qualifier,source,note,place_name,lat,lng,tags,' +
  'created_at,updated_at';

const CATEGORY_COLUMNS = 'id,name,color,sort_order,from_year,to_year';

// ---------------------------------------------------------------------------
// Mapování řádek <-> doména
// ---------------------------------------------------------------------------

export function categoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    fromYear: row.from_year,
    toYear: row.to_year,
  };
}

export function categoryToRow(draft: CategoryDraft): Omit<CategoryRow, 'id'> {
  return {
    name: draft.name,
    color: draft.color,
    sort_order: draft.sortOrder,
    from_year: draft.fromYear,
    to_year: draft.toYear,
  };
}

export function eventFromRow(row: EventRow): TimelineEvent {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    categoryId: row.category_id,
    start: {
      year: row.start_year,
      month: row.start_month,
      day: row.start_day,
      approx: row.start_approx,
      qualifier: row.start_qualifier,
    },
    end:
      row.type === 'range' && row.end_year !== null
        ? {
            year: row.end_year,
            month: row.end_month,
            day: row.end_day,
            approx: row.end_approx,
            qualifier: row.end_qualifier,
          }
        : null,
    source: row.source,
    note: row.note,
    placeName: row.place_name,
    lat: row.lat,
    lng: row.lng,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function eventToRow(draft: EventDraft): Omit<EventRow, 'id' | 'created_at' | 'updated_at'> {
  const isRange = draft.type === 'range' && draft.end !== null;
  return {
    name: draft.name,
    type: draft.type,
    category_id: draft.categoryId,
    start_year: draft.start.year,
    start_month: draft.start.month,
    start_day: draft.start.day,
    start_approx: draft.start.approx,
    start_qualifier: draft.start.qualifier,
    end_year: isRange ? (draft.end as NonNullable<typeof draft.end>).year : null,
    end_month: isRange ? (draft.end as NonNullable<typeof draft.end>).month : null,
    end_day: isRange ? (draft.end as NonNullable<typeof draft.end>).day : null,
    end_approx: isRange ? (draft.end as NonNullable<typeof draft.end>).approx : false,
    end_qualifier: isRange ? (draft.end as NonNullable<typeof draft.end>).qualifier : null,
    source: draft.source,
    note: draft.note,
    place_name: draft.placeName,
    lat: draft.lat,
    lng: draft.lng,
    tags: draft.tags,
  };
}

// ---------------------------------------------------------------------------
// Čtení
// ---------------------------------------------------------------------------

/** Načte kategorie i záznamy najednou (čtení je veřejné). */
export async function fetchDataset(timeoutMs = READ_TIMEOUT_MS): Promise<Dataset> {
  const client = requireSupabase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const [categories, events] = await Promise.all([
    client
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .order('sort_order', { ascending: true })
      .abortSignal(controller.signal),
    client
      .from('events')
      .select(EVENT_COLUMNS)
      .order('start_year', { ascending: true })
      .abortSignal(controller.signal),
  ]).finally(() => clearTimeout(timer));
  if (categories.error) throw asReadableError(categories.error);
  if (events.error) throw asReadableError(events.error);
  return {
    categories: (categories.data as unknown as CategoryRow[]).map(categoryFromRow),
    events: (events.data as unknown as EventRow[]).map(eventFromRow),
  };
}

/** Přeloží přerušení kvůli vypršení limitu na srozumitelnou hlášku. */
function asReadableError(error: { message?: string; name?: string }): Error {
  const message = error.message ?? '';
  if (error.name === 'AbortError' || /abort/i.test(message)) {
    return new Error(cs.app.loadTimeout);
  }
  return new Error(message || cs.app.error);
}

// ---------------------------------------------------------------------------
// Zápis (projde jen přihlášenému uživateli, hlídá RLS)
// ---------------------------------------------------------------------------

export async function createEvent(draft: EventDraft): Promise<TimelineEvent> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('events')
    .insert(eventToRow(draft))
    .select(EVENT_COLUMNS)
    .single();
  if (error) throw error;
  return eventFromRow(data as unknown as EventRow);
}

export async function updateEvent(id: string, draft: EventDraft): Promise<TimelineEvent> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('events')
    .update(eventToRow(draft))
    .eq('id', id)
    .select(EVENT_COLUMNS)
    .single();
  if (error) throw error;
  return eventFromRow(data as unknown as EventRow);
}

export async function deleteEvent(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('events').delete().eq('id', id);
  if (error) throw error;
}

export async function createCategory(draft: CategoryDraft): Promise<Category> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('categories')
    .insert(categoryToRow(draft))
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) throw error;
  return categoryFromRow(data as unknown as CategoryRow);
}

export async function updateCategory(id: string, draft: CategoryDraft): Promise<Category> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('categories')
    .update(categoryToRow(draft))
    .eq('id', id)
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) throw error;
  return categoryFromRow(data as unknown as CategoryRow);
}

/** Smazání kategorie: záznamy zůstávají, jen přijdou o kategorii (ON DELETE SET NULL). */
export async function deleteCategory(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function saveCategoryOrder(categories: Category[]): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('categories').upsert(
    categories.map((c) => ({ id: c.id, name: c.name, color: c.color, sort_order: c.sortOrder })),
    { onConflict: 'id' },
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Upsert podle id – „sloučit". */
export async function upsertDataset(dataset: Dataset): Promise<void> {
  const client = requireSupabase();
  if (dataset.categories.length > 0) {
    const { error } = await client.from('categories').upsert(
      dataset.categories.map((c) => ({ id: c.id, ...categoryToRow(c) })),
      { onConflict: 'id' },
    );
    if (error) throw error;
  }
  if (dataset.events.length > 0) {
    const { error } = await client.from('events').upsert(
      dataset.events.map((e) => ({ id: e.id, ...eventToRow(e) })),
      { onConflict: 'id' },
    );
    if (error) throw error;
  }
}

/** Smaže všechna data a nahraje soubor – „nahradit vše". */
export async function replaceDataset(dataset: Dataset): Promise<void> {
  const client = requireSupabase();
  // Nejprve záznamy, pak kategorie (kvůli cizímu klíči).
  const deleteEvents = await client.from('events').delete().not('id', 'is', null);
  if (deleteEvents.error) throw deleteEvents.error;
  const deleteCategories = await client.from('categories').delete().not('id', 'is', null);
  if (deleteCategories.error) throw deleteCategories.error;
  await upsertDataset(dataset);
}
