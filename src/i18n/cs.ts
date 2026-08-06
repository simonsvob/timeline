/**
 * Všechny texty rozhraní na jednom místě (příprava na případnou lokalizaci).
 * Aplikace jinde nesmí obsahovat viditelné řetězce – vždy sáhne sem.
 */

export const cs = {
  app: {
    title: 'Biblická časová osa',
    subtitle: 'Editor a prohlížeč',
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
    categories: 'Kategorie',
    data: 'Data',
  },

  auth: {
    signIn: 'Přihlásit se',
    signOut: 'Odhlásit se',
    signingIn: 'Přihlašuji…',
    email: 'E-mail',
    password: 'Heslo',
    signedInAs: 'Přihlášen(a):',
    readOnlyNotice: 'Prohlížení je veřejné. Pro úpravy se přihlaste.',
    invalidCredentials: 'Nesprávný e-mail nebo heslo.',
    noPublicSignUp: 'Registrace není veřejná – účty zakládá správce v Supabase.',
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
    goToYear: 'Přejít na rok',
    goToYearShort: 'Rok',
    go: 'Přejít',
    zoomIn: 'Přiblížit',
    zoomOut: 'Oddálit',
    zoomAll: 'Celý rozsah',
    searchPlaceholder: 'Hledat záznam podle jména…',
    noSearchResults: 'Nic nenalezeno',
    legend: 'Kategorie',
    legendShowAll: 'Zobrazit vše',
    legendHideAll: 'Skrýt vše',
    withoutCategory: 'Bez kategorie',
    emptyTitle: 'Zatím tu nic není',
    emptyBody: 'Přihlaste se a přidejte první záznam.',
    emptyBodyAnonymous: 'Časová osa zatím neobsahuje žádné záznamy.',
    minimapHint: 'Přehled celého rozsahu – tažením posunete výřez',
    recordCount: (shown: number, total: number) =>
      shown === total ? `${total} ${plural(total, 'záznam', 'záznamy', 'záznamů')}` : `${shown} z ${total} záznamů`,
    hiddenByFilter: 'skryto filtrem',
    scaleHint: 'Kolečkem myši nebo gestem přiblížíte, tažením posunete',
  },

  detail: {
    title: 'Detail záznamu',
    category: 'Kategorie',
    type: 'Typ',
    start: 'Začátek',
    end: 'Konec',
    when: 'Datace',
    source: 'Zdroj',
    note: 'Poznámka',
    place: 'Místo',
    coordinates: 'Souřadnice',
    tags: 'Štítky',
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
    category: 'Kategorie',
    categoryNone: '— bez kategorie —',
    manageCategories: 'Spravovat kategorie',
    start: 'Začátek',
    end: 'Konec',
    year: 'Rok',
    month: 'Měsíc',
    day: 'Den',
    era: 'Éra',
    monthNone: '—',
    dayNone: '—',
    approx: 'Přibližné',
    approxHint: 'Údaj je nejistý (zobrazí se s vlnovkou a rozostřeným okrajem)',
    source: 'Zdroj',
    sourcePlaceholder: 'např. 1. Mojžíšova 7,11',
    note: 'Poznámka',
    place: 'Místo',
    placePlaceholder: 'např. Jeruzalém',
    lat: 'Zeměpisná šířka',
    lng: 'Zeměpisná délka',
    tags: 'Štítky',
    tagsPlaceholder: 'Přidat štítek a stisknout Enter',
    tagRemove: (tag: string) => `Odebrat štítek ${tag}`,
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
    categoryNameRequired: 'Vyplňte název kategorie.',
  },

  table: {
    title: 'Tabulkový přehled',
    newEvent: 'Nový záznam',
    searchPlaceholder: 'Hledat v názvech, zdrojích, poznámkách a štítcích…',
    filterCategory: 'Kategorie',
    colName: 'Jméno',
    colCategory: 'Kategorie',
    colStart: 'Začátek',
    colEnd: 'Konec',
    colType: 'Typ',
    colTags: 'Štítky',
    empty: 'Žádné záznamy neodpovídají filtru.',
    sortAsc: 'vzestupně',
    sortDesc: 'sestupně',
    rowsInfo: (n: number) => `${n} ${plural(n, 'záznam', 'záznamy', 'záznamů')}`,
    showOnTimeline: 'Zobrazit na ose',
  },

  categories: {
    title: 'Správa kategorií',
    newCategory: 'Nová kategorie',
    name: 'Název',
    color: 'Barva',
    customColor: 'Vlastní barva (hex)',
    order: 'Pořadí',
    moveUp: 'Nahoru',
    moveDown: 'Dolů',
    eventCount: (n: number) => `${n} ${plural(n, 'záznam', 'záznamy', 'záznamů')}`,
    deleteConfirmTitle: 'Smazat kategorii?',
    deleteConfirmBody: (name: string, count: number) =>
      count > 0
        ? `Kategorie „${name}" bude smazána. ${count} ${plural(count, 'záznam zůstane', 'záznamy zůstanou', 'záznamů zůstane')} zachován${count === 1 ? '' : 'y'}, jen přijde o kategorii.`
        : `Opravdu smazat kategorii „${name}"?`,
    empty: 'Zatím žádné kategorie.',
    saveError: 'Kategorii se nepodařilo uložit.',
  },

  dataIO: {
    title: 'Export a import',
    export: 'Exportovat data',
    exportHint: 'Stáhne všechny kategorie i záznamy jako jeden JSON soubor.',
    exportFileName: 'biblicka-casova-osa',
    import: 'Importovat data',
    importHint: 'Nahrajte dříve exportovaný JSON soubor.',
    chooseFile: 'Vybrat soubor…',
    fileLabel: 'Soubor',
    previewTitle: 'Náhled importu',
    previewCounts: (categories: number, events: number) =>
      `Soubor obsahuje ${categories} ${plural(categories, 'kategorii', 'kategorie', 'kategorií')} a ${events} ${plural(events, 'záznam', 'záznamy', 'záznamů')}.`,
    schemaVersion: (v: number) => `Verze schématu: ${v}`,
    modeLabel: 'Způsob importu',
    modeMerge: 'Sloučit (upsert podle id)',
    modeMergeHint: 'Existující záznamy se stejným id se přepíšou, ostatní zůstanou.',
    modeReplace: 'Nahradit vše',
    modeReplaceHint: 'Nejprve se smažou všechna současná data, pak se nahraje soubor.',
    confirmReplaceTitle: 'Nahradit všechna data?',
    confirmReplaceBody:
      'Všechny současné kategorie a záznamy budou smazány a nahrazeny obsahem souboru. Tuto akci nelze vzít zpět.',
    confirmMergeTitle: 'Sloučit data?',
    confirmMergeBody: 'Záznamy se stejným id budou přepsány obsahem souboru.',
    runImport: 'Spustit import',
    importing: 'Importuji…',
    importDone: (categories: number, events: number) =>
      `Hotovo – naimportováno ${categories} kategorií a ${events} záznamů.`,
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
