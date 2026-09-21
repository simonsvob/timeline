/**
 * Odkazy v textových polích (zdroj, poznámka).
 *
 * Zápis je markdownový: `[wcg](https://…)` udělá z „wcg" klikací text.
 * Samotná adresa v textu se zaktivní taky, aby nebylo nutné nic obalovat.
 *
 * **Pouští se jen `http` a `https`.** Cokoli jiného (`javascript:`, `data:`)
 * zůstane obyčejným textem — text píše přihlášený uživatel, ale zobrazuje se
 * všem, takže se s ním nakládá jako s cizím vstupem.
 *
 * Čistá funkce bez DOM; vykreslení je v `components/RichText.tsx`.
 */

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string };

/**
 * `[popisek](adresa)` nebo holá adresa. Popisek nesmí obsahovat `]` ani konec
 * řádku, adresa mezeru ani `)` — díky tomu se závorka za odkazem chová jako
 * konec zápisu a ne jako součást adresy.
 */
const PATTERN = /\[([^\]\n]+)\]\(([^()\s]+)\)|(https?:\/\/[^\s<>[\]()]+)/gi;

/** Interpunkce na konci věty se do holé adresy nepočítá. */
const TRAILING = /[.,;:!?]+$/;

export function isSafeHref(href: string): boolean {
  return /^https?:\/\/\S+$/i.test(href);
}

/** Rozseká text na obyčejné úseky a odkazy. Prázdný text dá prázdné pole. */
export function parseLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;

  const pushText = (value: string) => {
    if (!value) return;
    const previous = segments[segments.length - 1];
    if (previous?.kind === 'text') previous.text += value;
    else segments.push({ kind: 'text', text: value });
  };

  PATTERN.lastIndex = 0;
  for (let match = PATTERN.exec(text); match !== null; match = PATTERN.exec(text)) {
    const [whole, label, href, bare] = match;
    pushText(text.slice(last, match.index));
    last = match.index + whole.length;

    if (bare) {
      const trimmed = bare.replace(TRAILING, '');
      if (isSafeHref(trimmed)) {
        segments.push({ kind: 'link', text: trimmed, href: trimmed });
        pushText(bare.slice(trimmed.length));
      } else {
        pushText(bare);
      }
      continue;
    }

    // Nepovolená adresa se neschovává za popisek – ukáže se, jak byla zapsána.
    if (isSafeHref(href)) segments.push({ kind: 'link', text: label, href });
    else pushText(whole);
  }

  pushText(text.slice(last));
  return segments;
}

/** Text bez značek odkazů – pro vyhledávání a pro popisky na plátně. */
export function stripLinks(text: string): string {
  return parseLinks(text)
    .map((segment) => segment.text)
    .join('');
}
