/**
 * Stav aplikace: data (období, štítky, záznamy) a přihlášení.
 * Datová vrstva je schovaná v ../data/repository – tady se řeší jen držení
 * stavu v paměti a promítnutí změn do UI.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { cs } from '../i18n/cs';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import * as repo from '../data/repository';
import type {
  Category,
  CategoryDraft,
  Dataset,
  EventDraft,
  Tag,
  TagDraft,
  TimelineEvent,
} from '../data/types';

interface AppState {
  configured: boolean;
  loading: boolean;
  error: string | null;
  categories: Category[];
  tags: Tag[];
  events: TimelineEvent[];
  categoryMap: Map<string, Category>;
  tagMap: Map<string, Tag>;
  session: Session | null;
  canEdit: boolean;
  reload: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveEvent: (id: string | null, draft: EventDraft) => Promise<TimelineEvent>;
  removeEvent: (id: string) => Promise<void>;
  saveCategory: (id: string | null, draft: CategoryDraft) => Promise<Category>;
  removeCategory: (id: string) => Promise<void>;
  reorderCategories: (ordered: Category[]) => Promise<void>;
  saveTag: (id: string | null, draft: TagDraft) => Promise<Tag>;
  removeTag: (id: string) => Promise<void>;
  importDataset: (dataset: Dataset, mode: 'merge' | 'replace') => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

function sortEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort(
    (a, b) =>
      a.start.year - b.start.year ||
      (a.start.month ?? 0) - (b.start.month ?? 0) ||
      (a.start.day ?? 0) - (b.start.day ?? 0) ||
      a.name.localeCompare(b.name, 'cs'),
  );
}

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'),
  );
}

function sortTags(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'));
}

/**
 * Tvrdá pojistka proti zaseknutí: kdyby se klient nedobral odpovědi (výpadek
 * sítě, viselé obnovení relace), aplikace nesmí zůstat na načítacím kolečku.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const dataset = await withTimeout(
        repo.fetchDataset(),
        repo.READ_TOTAL_BUDGET_MS + 2_000,
        cs.app.loadTimeout,
      );
      setCategories(sortCategories(dataset.categories));
      setTags(sortTags(dataset.tags));
      setEvents(sortEvents(dataset.events));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Nejdřív obnovit přihlášení, teprve pak číst data.
   *
   * Supabase klient načítá uloženou relaci z localStorage asynchronně. Když
   * se četlo hned při připojení komponenty, první dávka dotazů odešla ještě
   * anonymně a po obnovení relace se všechno stáhlo znovu jako přihlášený —
   * dvě kola tří dotazů čtyřicet milisekund po sobě, jak bylo vidět v logu.
   * Kromě zbytečné práce to zvětšovalo okno, ve kterém se dá trefit čerstvě
   * podepsaný token a narazit na rozejité hodiny.
   */
  useEffect(() => {
    if (!supabase) {
      void reload();
      return;
    }
    let zruseno = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!zruseno) setSession(data.session);
      })
      // Nepovedené obnovení relace nesmí zabránit čtení — data jsou veřejná.
      .catch(() => undefined)
      .finally(() => {
        if (!zruseno) void reload();
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      zruseno = true;
      listener.subscription.unsubscribe();
    };
  }, [reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase není nakonfigurováno.');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const saveEvent = useCallback(async (id: string | null, draft: EventDraft) => {
    const saved = id ? await repo.updateEvent(id, draft) : await repo.createEvent(draft);
    setEvents((prev) =>
      sortEvents(id ? prev.map((e) => (e.id === id ? saved : e)) : [...prev, saved]),
    );
    return saved;
  }, []);

  const removeEvent = useCallback(async (id: string) => {
    await repo.deleteEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const saveCategory = useCallback(async (id: string | null, draft: CategoryDraft) => {
    const saved = id ? await repo.updateCategory(id, draft) : await repo.createCategory(draft);
    setCategories((prev) =>
      sortCategories(id ? prev.map((c) => (c.id === id ? saved : c)) : [...prev, saved]),
    );
    return saved;
  }, []);

  const removeCategory = useCallback(async (id: string) => {
    await repo.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const saveTag = useCallback(async (id: string | null, draft: TagDraft) => {
    const saved = id ? await repo.updateTag(id, draft) : await repo.createTag(draft);
    setTags((prev) => sortTags(id ? prev.map((t) => (t.id === id ? saved : t)) : [...prev, saved]));
    return saved;
  }, []);

  const removeTag = useCallback(async (id: string) => {
    await repo.deleteTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
    // záznamy zůstávají, jen přijdou o barvu (ON DELETE SET NULL)
    setEvents((prev) => prev.map((e) => (e.tagId === id ? { ...e, tagId: null } : e)));
  }, []);

  const reorderCategories = useCallback(async (ordered: Category[]) => {
    const renumbered = ordered.map((c, index) => ({ ...c, sortOrder: index }));
    setCategories(renumbered);
    await repo.saveCategoryOrder(renumbered);
  }, []);

  const importDataset = useCallback(
    async (dataset: Dataset, mode: 'merge' | 'replace') => {
      if (mode === 'replace') await repo.replaceDataset(dataset);
      else await repo.upsertDataset(dataset);
      await reload();
    },
    [reload],
  );

  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t] as const)), [tags]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories],
  );

  const value = useMemo<AppState>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      error,
      categories,
      tags,
      events,
      categoryMap,
      tagMap,
      session,
      canEdit: session !== null,
      reload,
      signIn,
      signOut,
      saveEvent,
      removeEvent,
      saveCategory,
      removeCategory,
      reorderCategories,
      saveTag,
      removeTag,
      importDataset,
    }),
    [
      loading,
      error,
      categories,
      tags,
      events,
      categoryMap,
      tagMap,
      session,
      reload,
      signIn,
      signOut,
      saveEvent,
      removeEvent,
      saveCategory,
      removeCategory,
      reorderCategories,
      saveTag,
      removeTag,
      importDataset,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState musí být uvnitř AppStateProvider.');
  return value;
}
