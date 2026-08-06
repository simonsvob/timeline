/**
 * Klient Supabase. Přístup k datům jde přímo z prohlížeče, žádný vlastní
 * server – zápisy hlídá RLS (čtení anon, zápis jen authenticated).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Klient je null, když chybí konfigurace – aplikace pak zobrazí nápovědu
 * místo toho, aby spadla při startu.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase není nakonfigurováno (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).');
  }
  return supabase;
}
