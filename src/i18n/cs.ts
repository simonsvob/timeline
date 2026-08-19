/**
 * Všechny texty rozhraní na jednom místě (příprava na případnou lokalizaci).
 * Aplikace jinde nesmí obsahovat viditelné řetězce – vždy sáhne sem.
 */

export const cs = {
  app: {
    title: 'Biblická časová osa',
    loading: 'Načítám data…',
    error: 'Chyba',
    retry: 'Zkusit znovu',
    close: 'Zavřít',
    cancel: 'Zrušit',
    save: 'Uložit',
    saving: 'Ukládám…',
    delete: 'Smazat',
    edit: 'Upravit',
    confirm: 'Potvrdit',
    add: 'Přidat',
    search: 'Hledat',
    all: 'Vše',
    none: 'Žádná',
    yes: 'Ano',
    no: 'Ne',
    unsavedChanges: 'Máte neuložené změny. Opravdu zavřít?',
    loadTimeout: 'Načítání dat trvá příliš dlouho. Zkontrolujte připojení a zkuste to znovu.',
  },

  nav: {
    timeline: 'Osa',
    table: 'Tabulka',
    tags: 'Štítky',
    periods: 'Období',
    data: 'Data',
  },

  auth: {
    signIn: 'Přihlásit se',
    signOut: 'Odhlásit se',
    signingIn: 'Přihlašuji…',
    email: 'E-mail',
    password: 'Heslo',
    invalidCredentials: 'Nesprávný e-mail nebo heslo.',
    signInTitle: 'Přihlášení editora',
    signInFailed: 'Přihlášení se nezdařilo.',
  },

  config: {
    missingTitle: 'Chybí nastavení Supabase',
    missingBody:
      'Nejsou vyplněné proměnné prostředí VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY. ' +
      'Pro lokální vývoj je zkopírujte do souboru .env (viz .env.example), ' +
      'na Netlify je nastavte v Site settings → Environment variables.',
  },

  era: {
    bc: 'př. n. l.',
    ad: 'n. l.',
    bcLong: 'před naším letopočtem',
    adLong: 'našeho letopočtu',
  },

  qualifier: {
    none: '—',
    min: 'min.',
    after: 'po roce',
    before: 'před rokem',
    minLabel: 'minimálně do (rok konce není znám)',
    afterLabel: 'po roce (nastalo někdy potom)',
    beforeLabel: 'před rokem (nastalo někdy předtím)',
    openEnd: 'Otevřená hranice',
    openEndHint: 'Rok není znám, ví se jen, že leží za zadaným rokem',
    atLeast: 'nejméně',
  },

  months: {
    nominative: [
      'leden',
      'únor',
      'březen',
      'duben',
      'květen',
      'červen',
      'červenec',
      'srpen',
      'září',
      'říjen',
      'listopad',
      'prosinec',
    ],
    genitive: [
      'ledna',
      'února',
      'března',
      'dubna',
      'května',
      'června',
      'července',
      'srpna',
      'září',
      'října',
      'listopadu',
      'prosince',
    ],
  },

  timeline: {
    searchPlaceholder: 'Hledat…',
    noSearchResults: 'Nic nenalezeno',
    legend: 'Pásma',
    legendShow: 'Zobrazit pásma',
    legendHide: 'Skrýt pásma',
    withoutTag: 'Bez štítku',
    emptyTitle: 'Zatím tu nic není',
    minimapHint: 'Přehled celého rozsahu – tažením posunete výřez',
    /** Názvy pásem osy; klíče odpovídají `BANDS` v components/timeline/layout.ts. */
    bands: {
      velmoci: 'Světové velmoci',
      udalosti: 'Události',
      zivoty: 'Životy',
      knihy: 'Knihy – zahrnuté období',
      izrael: 'Vláda – severní izraelské království',
      juda: 'Vláda – jižní judské království',
      ostatni: 'Ostatní',
    },
  },

  detail: {
    title: 'Detail záznamu',
    tag: 'Štítek',
    placement: 'Umístění',
    type: 'Typ',
    start: 'Začátek',
    end: 'Konec',
    when: 'Datace',
    source: 'Zdroj',
    note: 'Poznámka',
    place: 'Místo',
    coordinates: 'Souřadnice',
    keywords: 'Klíčová slova',
    duration: 'Trvání',
    durationYears: (n: number) => `${formatNumber(n)} ${plural(n, 'rok', 'roky', 'let')}`,
    durationApprox: 'přibližně',
    deleteConfirmTitle: 'Smazat záznam?',
    deleteConfirmBody: (name: string) => `Opravdu smazat záznam „${name}"? Tuto akci nelze vzít zpět.`,
  },

  form: {
    newTitle: 'Nový záznam',
    editTitle: 'Upravit záznam',
    name: 'Jméno',
    namePlaceholder: 'např. Potopa',
    type: 'Typ',
    typePoint: 'Bod',
    typeRange: 'Rozsah',
    placement: 'Umístění na ose',
    placementHint: 'Do kterého pásma záznam patří; chování pásma je dané kódem',
    tag: 'Štítek',
    tagHint: 'Určuje barvu záznamu na ose',
    tagNone: '— bez štítku —',
    manageTags: 'Spravovat štítky',
    start: 'Začátek',
    end: 'Konec',
    year: 'Rok',
    month: 'Měsíc',
    day: 'Den',
    era: 'Éra',
    monthNone: '—',
    dayNone: '—',
    approx: 'Přibližné',
    approxHint: 'Rok je jen odhad; na ose se pruh na této straně rozplyne do ztracena',
    source: 'Zdroj',
    sourcePlaceholder: 'např. 1. Mojžíšova 7,11',
    note: 'Poznámka',
    place: 'Místo',
    placePlaceholder: 'např. Jeruzalém',
    lat: 'Zeměpisná šířka',
    lng: 'Zeměpisná délka',
    keywords: 'Klíčová slova',
    keywordsHint: 'Jen popisná – na vykreslení ani na barvu nemají vliv',
    keywordsPlaceholder: 'Přidat klíčové slovo a stisknout Enter',
    keywordRemove: (keyword: string) => `Odebrat klíčové slovo ${keyword}`,
    optional: 'nepovinné',
    preview: 'Náhled datace',
    saveError: 'Záznam se nepodařilo uložit.',
    deleteError: 'Záznam se nepodařilo smazat.',
  },

  validation: {
    nameRequired: 'Vyplňte jméno záznamu.',
    yearRequired: 'Vyplňte rok.',
    yearInvalid: 'Rok musí být celé kladné číslo.',
    yearZero: 'Rok 0 neexistuje – 1 př. n. l. bezprostředně předchází 1 n. l.',
    yearTooLarge: 'Rok je mimo podporovaný rozsah.',
    monthInvalid: 'Měsíc musí být 1–12.',
    dayInvalid: 'Den musí být 1–31.',
    dayNotInMonth: (day: number, month: number) => `Den ${day} v měsíci ${month} neexistuje.`,
    dayNeedsMonth: 'Den lze zadat jen spolu s měsícem.',
    endRequired: 'U rozsahu vyplňte konec.',
    endBeforeStart: 'Konec nesmí být dříve než začátek.',
    latInvalid: 'Zeměpisná šířka musí být v rozsahu −90 až 90.',
    lngInvalid: 'Zeměpisná délka musí být v rozsahu −180 až 180.',
    latLngPair: 'Vyplňte obě souřadnice, nebo žádnou.',
    colorInvalid: 'Barva musí být hex, např. #a2563c.',
    categoryNameRequired: 'Vyplňte název období.',
    tagNameRequired: 'Vyplňte název štítku.',
  },

  table: {
    title: 'Tabulkový přehled',
    newEvent: 'Nový záznam',
    searchPlaceholder: 'Hledat v názvech, zdrojích, poznámkách a klíčových slovech…',
    filterTag: 'Štítek',
    filterPlacement: 'Umístění',
    colName: 'Jméno',
    colTag: 'Štítek',
    colPlacement: 'Umístění',
    colStart: 'Začátek',
    colEnd: 'Konec',
    colType: 'Typ',
    colKeywords: 'Klíčová slova',
    empty: 'Žádné záznamy neodpovídají filtru.',
    sortAsc: 'vzestupně',
    sortDesc: 'sestupně',
    rowsInfo: (n: number) => `${n} ${plural(n, 'záznam', 'záznamy', 'záznamů')}`,
    showOnTimeline: 'Zobrazit na ose',
  },

  categories: {
    title: 'Období na ose',
    intro:
      'Období barví centrální čáru a minimapu podle toho, KDY se něco stalo. ' +
      'Na barvu jednotlivých záznamů nemají vliv – tu určuje štítek.',
    newCategory: 'Nové období',
    name: 'Název',
    color: 'Barva',
    customColor: 'Vlastní barva (hex)',
    order: 'Pořadí',
    moveUp: 'Nahoru',
    moveDown: 'Dolů',
    span: (text: string) => `Rozsah: ${text}`,
    spanNone: 'Bez vymezeného rozsahu – osu nebarví',
    deleteConfirmTitle: 'Smazat období?',
    deleteConfirmBody: (name: string) => `Opravdu smazat období „${name}"? Záznamů se to nedotkne.`,
    empty: 'Zatím žádná období.',
    saveError: 'Období se nepodařilo uložit.',
  },

  tags: {
    title: 'Štítky',
    intro:
      'Štítek říká, CO záznam je, a dává mu barvu na ose. Každý záznam má nejvýš jeden. ' +
      'Kam na osu záznam padne, řeší jeho umístění, ne štítek.',
    newTag: 'Nový štítek',
    name: 'Název',
    color: 'Barva',
    customColor: 'Vlastní barva (hex)',
    order: 'Pořadí',
    moveUp: 'Nahoru',
    moveDown: 'Dolů',
    eventCount: (n: number) => `${n} ${plural(n, 'záznam', 'záznamy', 'záznamů')}`,
    unused: 'zatím nepoužitý',
    placementsTitle: 'Umístění na ose',
    placementsIntro:
      'Kam záznam na ose padne. Seznam je pevný – ke každé volbě patří i kus ' +
      'vykreslení (připnutý pás u okraje, jedna řada, tvar). Vybírá se u záznamu.',
    deleteConfirmTitle: 'Smazat štítek?',
    deleteConfirmBody: (name: string, count: number) =>
      count > 0
        ? `Štítek „${name}" bude smazán. ${count} ${plural(count, 'záznam zůstane', 'záznamy zůstanou', 'záznamů zůstane')} zachován${count === 1 ? '' : 'y'}, jen přijde o barvu.`
        : `Opravdu smazat štítek „${name}"?`,
    empty: 'Zatím žádné štítky.',
    saveError: 'Štítek se nepodařilo uložit.',
  },

  dataIO: {
    title: 'Data',
    overview: 'Přehled',
    counts: (categories: number, tags: number, events: number) =>
      `${events} ${plural(events, 'záznam', 'záznamy', 'záznamů')}, ` +
      `${tags} ${plural(tags, 'štítek', 'štítky', 'štítků')}, ` +
      `${categories} ${plural(categories, 'období', 'období', 'období')}`,
    export: 'Exportovat data',
    exportHint: 'Stáhne období, štítky i záznamy jako jeden JSON soubor.',
    exportFileName: 'biblicka-casova-osa',
    import: 'Importovat data',
    importHint: 'Nahrajte dříve exportovaný JSON soubor.',
    chooseFile: 'Vybrat soubor…',
    fileLabel: 'Soubor',
    previewTitle: 'Náhled importu',
    previewCounts: (categories: number, tags: number, events: number) =>
      `Soubor obsahuje ${categories} ${plural(categories, 'období', 'období', 'období')}, ` +
      `${tags} ${plural(tags, 'štítek', 'štítky', 'štítků')} a ` +
      `${events} ${plural(events, 'záznam', 'záznamy', 'záznamů')}.`,
    schemaVersion: (v: number) => `Verze schématu: ${v}`,
    modeLabel: 'Způsob importu',
    modeMerge: 'Sloučit (upsert podle id)',
    modeMergeHint: 'Existující záznamy se stejným id se přepíšou, ostatní zůstanou.',
    modeReplace: 'Nahradit vše',
    modeReplaceHint: 'Nejprve se smažou všechna současná data, pak se nahraje soubor.',
    confirmReplaceTitle: 'Nahradit všechna data?',
    confirmReplaceBody:
      'Všechna současná období, štítky a záznamy budou smazány a nahrazeny obsahem souboru. Tuto akci nelze vzít zpět.',
    confirmMergeTitle: 'Sloučit data?',
    confirmMergeBody: 'Záznamy se stejným id budou přepsány obsahem souboru.',
    runImport: 'Spustit import',
    importing: 'Importuji…',
    importDone: (categories: number, tags: number, events: number) =>
      `Hotovo – naimportováno ${categories} období, ${tags} štítků a ${events} záznamů.`,
    invalidJson: 'Soubor není platný JSON.',
    invalidSchema: 'Soubor nemá očekávanou strukturu exportu.',
    unsupportedVersion: (v: unknown) => `Nepodporovaná verze schématu: ${String(v)}.`,
    signInRequired: 'Import je dostupný jen po přihlášení.',
  },

  a11y: {
    timelineCanvas: 'Časová osa – interaktivní plátno',
    minimapCanvas: 'Minimapa časové osy',
    openDetail: 'Otevřít detail',
    closePanel: 'Zavřít panel',
  },
} as const;

// ---------------------------------------------------------------------------
// Pomocné funkce pro české tvary
// ---------------------------------------------------------------------------

/** Česká plurálová trojice: 1 / 2–4 / 0 a 5+. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4 && Number.isInteger(abs)) return few;
  return many;
}

/** Číslo s mezerou jako oddělovačem tisíců (české zvyklosti). */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [intPart, decPart] = String(rounded).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart ? `${grouped},${decPart}` : grouped;
}
