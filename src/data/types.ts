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

// ---------------------------------------------------------------------------
// Osoby a rodinné vazby (sekce Rodokmen)
// ---------------------------------------------------------------------------

/**
 * Role, podle kterých se osoby v rodokmenu barví. Pevný seznam jako u
 * umístění: ke každé hodnotě patří barva a popisek v rozhraní.
 */
export type PersonRole = 'kral' | 'veleknez' | 'soudce' | 'prorok';
export const PERSON_ROLES: readonly PersonRole[] = ['kral', 'veleknez', 'soudce', 'prorok'];

/**
 * Osoba je samostatná věc, ne záznam osy: David má na ose život i vládu,
 * jeden pruh „Daniel, Chananjáš, Mišael, Azarjáš“ jsou čtyři lidé a většina
 * osob rodokmenu na ose není vůbec.
 */
export interface Person {
  id: string;
  name: string;
  /** rozlišovač stejnojmenných – „syn Teracha“ */
  qualifier: string | null;
  /** jiné podoby jména ve zdrojích (Kenan / Kainan) */
  altNames: string[];
  gender: 'm' | 'f' | null;
  roles: string[];
  /** hlavní linie rodokmenu; výslovný příznak, o páteři rozhoduje člověk */
  spine: boolean;
  note: string | null;
}

export type PersonEventRole = 'zivot' | 'vlada' | 'zminka';

/** Který záznam osy k osobě patří a v jaké roli. */
export interface PersonEventLink {
  personId: string;
  eventId: string;
  role: PersonEventRole;
}

/**
 * `rodic` a `pestoun`: `from` je rodič, `to` dítě. `predek`: zdroj mezi nimi
 * generace vynechává. `manzelstvi`: na pořadí nezáleží.
 */
export type RelationKind = 'rodic' | 'pestoun' | 'predek' | 'manzelstvi';
/** Jistota tvrzení – nezávislá na tom, jestli vazbu někdo ověřil. */
export type RelationCertainty = 'vyslovne' | 'odvozeno' | 'sporne';

export interface Relation {
  id: string;
  kind: RelationKind;
  fromPerson: string;
  toPerson: string;
  certainty: RelationCertainty;
  /** stejný zápis jako zdroj záznamu, včetně odkazů `[text](https://…)` */
  source: string | null;
  note: string | null;
  /** ověřeno člověkem proti Bibli nebo publikaci; neověřené vidí jen přihlášený */
  verified: boolean;
  /** pořadí dítěte mezi sourozenci */
  sortOrder: number;
}

/** Co jde u vazby upravit z aplikace. */
export type RelationPatch = Pick<Relation, 'certainty' | 'source' | 'note' | 'verified'>;

export interface Kinship {
  persons: Person[];
  links: PersonEventLink[];
  relations: Relation[];
}

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
