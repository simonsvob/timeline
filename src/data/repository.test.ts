/**
 * Opakování čtení. Jediný test v projektu, který si obchází Supabase klienta —
 * jinde se testuje čistá logika. Stojí to za to: chování se projeví jen při
 * chybě serveru, takže regresi by si nikdo nevšiml, dokud se aplikace zase
 * nezačne uživateli sekat na hlášce „JWT issued at future“.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

let selhaniZbyva = 0;
let chyba: { message: string; name: string } = { message: '', name: '' };
let volani = 0;

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {},
  requireSupabase: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          abortSignal: () => {
            volani++;
            if (selhaniZbyva > 0) {
              selhaniZbyva--;
              return Promise.resolve({ data: null, error: chyba });
            }
            return Promise.resolve({ data: [], error: null });
          },
        }),
      }),
    }),
  }),
}));

const { fetchDataset } = await import('./repository');

/** Jeden pokus = tři souběžné dotazy (období, štítky, záznamy). */
const DOTAZU_NA_POKUS = 3;

describe('opakování čtení', () => {
  beforeEach(() => {
    volani = 0;
    selhaniZbyva = 0;
    chyba = { message: 'JWT issued at future', name: 'AuthApiError' };
  });

  it('rozejité hodiny u tokenu zopakuje a nakonec uspěje', async () => {
    selhaniZbyva = DOTAZU_NA_POKUS;
    const dataset = await fetchDataset(1_000);
    expect(dataset.events).toEqual([]);
    expect(volani).toBe(2 * DOTAZU_NA_POKUS);
  });

  it('trvalou chybu neopakuje – opakováním by se nespravila', async () => {
    chyba = { message: 'relation "events" does not exist', name: 'PostgrestError' };
    selhaniZbyva = Number.MAX_SAFE_INTEGER;
    await expect(fetchDataset(1_000)).rejects.toThrow(/does not exist/);
    expect(volani).toBe(DOTAZU_NA_POKUS);
  });

  it('po vyčerpání pokusů chybu propustí, neopakuje donekonečna', async () => {
    selhaniZbyva = Number.MAX_SAFE_INTEGER;
    await expect(fetchDataset(1_000)).rejects.toThrow(/JWT/);
    expect(volani).toBe(3 * DOTAZU_NA_POKUS);
  });
});
