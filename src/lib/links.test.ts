import { describe, expect, it } from 'vitest';
import { insertLinkTemplate, parseLinks, stripLinks } from './links';

describe('odkazy v textu', () => {
  it('prázdný text nedá žádný úsek', () => {
    expect(parseLinks('')).toEqual([]);
  });

  it('text bez odkazu zůstane jedním úsekem', () => {
    expect(parseLinks('wcg str. 14')).toEqual([{ kind: 'text', text: 'wcg str. 14' }]);
  });

  it('popisek může být jiný než adresa', () => {
    expect(parseLinks('[wcg](https://priklad.cz/kniha#odst3)')).toEqual([
      { kind: 'link', text: 'wcg', href: 'https://priklad.cz/kniha#odst3' },
    ]);
  });

  it('odkaz uprostřed věty nechá text kolem sebe', () => {
    expect(parseLinks('viz [wcg](https://priklad.cz) str. 14')).toEqual([
      { kind: 'text', text: 'viz ' },
      { kind: 'link', text: 'wcg', href: 'https://priklad.cz' },
      { kind: 'text', text: ' str. 14' },
    ]);
  });

  it('holá adresa se zaktivní sama', () => {
    expect(parseLinks('zdroj: https://priklad.cz/a')).toEqual([
      { kind: 'text', text: 'zdroj: ' },
      { kind: 'link', text: 'https://priklad.cz/a', href: 'https://priklad.cz/a' },
    ]);
  });

  it('tečka za holou adresou zůstane textem', () => {
    expect(parseLinks('viz https://priklad.cz/a.')).toEqual([
      { kind: 'text', text: 'viz ' },
      { kind: 'link', text: 'https://priklad.cz/a', href: 'https://priklad.cz/a' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('zvládne víc odkazů za sebou', () => {
    const segments = parseLinks('[a](https://a.cz) a [b](https://b.cz)');
    expect(segments.filter((s) => s.kind === 'link')).toHaveLength(2);
  });

  it('jiné schéma než http(s) se nespustí – zůstane textem', () => {
    expect(parseLinks('[klik](javascript:alert(1))')).toEqual([
      { kind: 'text', text: '[klik](javascript:alert(1))' },
    ]);
    expect(parseLinks('[x](data:text/html,<b>)')).toEqual([
      { kind: 'text', text: '[x](data:text/html,<b>)' },
    ]);
  });

  it('nedokončený zápis zůstane textem', () => {
    expect(parseLinks('[wcg](')).toEqual([{ kind: 'text', text: '[wcg](' }]);
    expect(parseLinks('[wcg] (https://a.cz)')).toEqual([
      { kind: 'text', text: '[wcg] (' },
      { kind: 'link', text: 'https://a.cz', href: 'https://a.cz' },
      { kind: 'text', text: ')' },
    ]);
  });

  it('víceřádkový text si zachová zlomy', () => {
    expect(stripLinks('první\n[druhý](https://a.cz)')).toBe('první\ndruhý');
  });

  it('stripLinks nechá z odkazu jen popisek', () => {
    expect(stripLinks('viz [wcg](https://priklad.cz) str. 14')).toBe('viz wcg str. 14');
  });
});

describe('vložení kostry odkazu', () => {
  it('bez výběru vloží []() a kurzor dá do hranatých závorek', () => {
    expect(insertLinkTemplate('wcg, kr', 5, 5)).toEqual({ text: 'wcg, []()kr', cursor: 6 });
  });

  it('vybraný text se stane popiskem a kurzor jde na místo adresy', () => {
    expect(insertLinkTemplate('it „Potopa“', 0, 11)).toEqual({ text: '[it „Potopa“]()', cursor: 14 });
  });

  it('do prázdného pole i na konec textu', () => {
    expect(insertLinkTemplate('', 0, 0)).toEqual({ text: '[]()', cursor: 1 });
    expect(insertLinkTemplate('wcg', 3, 3)).toEqual({ text: 'wcg[]()', cursor: 4 });
  });

  it('kurzor mimo text se ořízne na jeho délku', () => {
    expect(insertLinkTemplate('ab', 9, 9)).toEqual({ text: 'ab[]()', cursor: 3 });
  });
});
