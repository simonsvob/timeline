import { describe, expect, it } from 'vitest';
import {
  emptyEventForm,
  validateCategoryForm,
  validateEventForm,
  isValidHexColor,
  type EventFormInput,
} from './validation';

function form(overrides: Partial<EventFormInput> = {}): EventFormInput {
  return { ...emptyEventForm(), name: 'Potopa', ...overrides };
}

function startInput(over: Partial<EventFormInput['start']> = {}) {
  return { year: '2370', era: 'bc' as const, month: '', day: '', approx: false, ...over };
}

describe('validace jména', () => {
  it('vyžaduje jméno', () => {
    const res = validateEventForm(form({ name: '   ', start: startInput() }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.name).toBeTruthy();
  });

  it('ořízne mezery kolem jména', () => {
    const res = validateEventForm(form({ name: '  Potopa  ', start: startInput() }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.name).toBe('Potopa');
  });
});

describe('validace roku', () => {
  it('vyžaduje rok', () => {
    const res = validateEventForm(form({ start: startInput({ year: '' }) }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors['start.year']).toBeTruthy();
  });

  it('odmítne rok 0', () => {
    const res = validateEventForm(form({ start: startInput({ year: '0' }) }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors['start.year']).toContain('0');
  });

  it('odmítne nečíselný a záporný rok', () => {
    expect(validateEventForm(form({ start: startInput({ year: 'abc' }) })).ok).toBe(false);
    expect(validateEventForm(form({ start: startInput({ year: '-5' }) })).ok).toBe(false);
    expect(validateEventForm(form({ start: startInput({ year: '12,5' }) })).ok).toBe(false);
  });

  it('odmítne nesmyslně velký rok', () => {
    expect(validateEventForm(form({ start: startInput({ year: '1000000' }) })).ok).toBe(false);
  });

  it('převede rok a éru na astronomický rok', () => {
    const bc = validateEventForm(form({ start: startInput({ year: '1512', era: 'bc' }) }));
    expect(bc.ok).toBe(true);
    if (bc.ok) expect(bc.value.start.year).toBe(-1511);

    const ad = validateEventForm(form({ start: startInput({ year: '33', era: 'ad' }) }));
    expect(ad.ok).toBe(true);
    if (ad.ok) expect(ad.value.start.year).toBe(33);

    const bc1 = validateEventForm(form({ start: startInput({ year: '1', era: 'bc' }) }));
    expect(bc1.ok).toBe(true);
    if (bc1.ok) expect(bc1.value.start.year).toBe(0);
  });
});

describe('validace měsíce a dne', () => {
  it('den vyžaduje měsíc', () => {
    const res = validateEventForm(form({ start: startInput({ day: '7' }) }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors['start.day']).toBeTruthy();
  });

  it('měsíc bez dne je v pořádku (přesnost = měsíc)', () => {
    const res = validateEventForm(form({ start: startInput({ month: '10' }) }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.start.month).toBe(10);
      expect(res.value.start.day).toBeNull();
    }
  });

  it('prázdný měsíc i den dají přesnost na rok', () => {
    const res = validateEventForm(form({ start: startInput() }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.start.month).toBeNull();
      expect(res.value.start.day).toBeNull();
    }
  });

  it('odmítne měsíc mimo 1–12', () => {
    expect(validateEventForm(form({ start: startInput({ month: '0' }) })).ok).toBe(false);
    expect(validateEventForm(form({ start: startInput({ month: '13' }) })).ok).toBe(false);
  });

  it('odmítne den, který v měsíci neexistuje', () => {
    const res = validateEventForm(form({ start: startInput({ month: '2', day: '30' }) }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors['start.day']).toBeTruthy();
    expect(validateEventForm(form({ start: startInput({ month: '4', day: '31' }) })).ok).toBe(false);
    expect(validateEventForm(form({ start: startInput({ month: '1', day: '31' }) })).ok).toBe(true);
  });
});

describe('validace rozsahu', () => {
  const range = (endOver: Partial<EventFormInput['end']>, startOver = {}) =>
    validateEventForm(
      form({
        type: 'range',
        start: startInput(startOver),
        end: { year: '2370', era: 'bc', month: '', day: '', approx: false, ...endOver },
      }),
    );

  it('vyžaduje konec u rozsahu', () => {
    const res = range({ year: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors['end.year']).toBeTruthy();
  });

  it('odmítne konec dříve než začátek', () => {
    // začátek 2370 př. n. l. (-2369), konec 2400 př. n. l. (-2399) je dřív
    const res = range({ year: '2400', era: 'bc' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors['end.year']).toBeTruthy();
  });

  it('povolí konec ve stejném roce jako začátek', () => {
    expect(range({ year: '2370', era: 'bc' }).ok).toBe(true);
  });

  it('porovnává správně přes přelom letopočtu', () => {
    // začátek 4 př. n. l., konec 33 n. l.
    expect(range({ year: '33', era: 'ad' }, { year: '4', era: 'bc' }).ok).toBe(true);
    // začátek 33 n. l., konec 4 př. n. l. -> chyba
    expect(range({ year: '4', era: 'bc' }, { year: '33', era: 'ad' }).ok).toBe(false);
  });

  it('porovnává i podle měsíce a dne', () => {
    expect(range({ year: '2370', era: 'bc', month: '3' }, { year: '2370', era: 'bc', month: '5' }).ok)
      .toBe(false);
    expect(range({ year: '2370', era: 'bc', month: '5' }, { year: '2370', era: 'bc', month: '3' }).ok)
      .toBe(true);
    expect(
      range(
        { year: '2370', era: 'bc', month: '3', day: '1' },
        { year: '2370', era: 'bc', month: '3', day: '15' },
      ).ok,
    ).toBe(false);
  });

  it('bod zahodí případná koncová pole', () => {
    const res = validateEventForm(
      form({
        type: 'point',
        start: startInput(),
        end: { year: '2000', era: 'bc', month: '', day: '', approx: false },
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.end).toBeNull();
  });

  it('rozsah nese vlastní jistotu na obou stranách', () => {
    const res = validateEventForm(
      form({
        type: 'range',
        start: startInput({ approx: true }),
        end: { year: '2000', era: 'bc', month: '', day: '', approx: false },
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.start.approx).toBe(true);
      expect(res.value.end?.approx).toBe(false);
    }
  });
});

describe('validace souřadnic', () => {
  it('přijme prázdné souřadnice', () => {
    const res = validateEventForm(form({ start: startInput(), lat: '', lng: '' }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.lat).toBeNull();
      expect(res.value.lng).toBeNull();
    }
  });

  it('vyžaduje obě, nebo žádnou', () => {
    expect(validateEventForm(form({ start: startInput(), lat: '31.7' })).ok).toBe(false);
    expect(validateEventForm(form({ start: startInput(), lng: '35.2' })).ok).toBe(false);
    expect(validateEventForm(form({ start: startInput(), lat: '31.7', lng: '35.2' })).ok).toBe(true);
  });

  it('hlídá rozsah a přijme desetinnou čárku', () => {
    expect(validateEventForm(form({ start: startInput(), lat: '91', lng: '0' })).ok).toBe(false);
    expect(validateEventForm(form({ start: startInput(), lat: '0', lng: '181' })).ok).toBe(false);
    const res = validateEventForm(form({ start: startInput(), lat: '31,7', lng: '-35,2' }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.lat).toBeCloseTo(31.7, 10);
      expect(res.value.lng).toBeCloseTo(-35.2, 10);
    }
  });
});

describe('nepovinná pole', () => {
  it('prázdné texty ukládá jako null', () => {
    const res = validateEventForm(form({ start: startInput(), source: '  ', note: '', placeName: '' }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.source).toBeNull();
      expect(res.value.note).toBeNull();
      expect(res.value.placeName).toBeNull();
    }
  });

  it('štítky ořezává a odstraňuje duplicity a prázdné', () => {
    const res = validateEventForm(
      form({ start: startInput(), tags: [' patriarchové ', 'patriarchové', '', 'potopa'] }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.tags).toEqual(['patriarchové', 'potopa']);
  });
});

describe('validace kategorie', () => {
  it('vyžaduje název a platnou hex barvu', () => {
    expect(validateCategoryForm('Patriarchové', '#a2563c')).toEqual({});
    expect(validateCategoryForm('', '#a2563c').name).toBeTruthy();
    expect(validateCategoryForm('Patriarchové', 'červená').color).toBeTruthy();
    expect(validateCategoryForm('Patriarchové', '#abc').color).toBeTruthy();
  });

  it('pozná platnou hex barvu', () => {
    expect(isValidHexColor('#a2563c')).toBe(true);
    expect(isValidHexColor('#A2563C')).toBe(true);
    expect(isValidHexColor('a2563c')).toBe(false);
    expect(isValidHexColor('#a2563')).toBe(false);
  });
});
