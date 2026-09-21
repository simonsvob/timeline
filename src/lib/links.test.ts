import { describe, expect, it } from 'vitest';
import { parseLinks, stripLinks } from './links';

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
