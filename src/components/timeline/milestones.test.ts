import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../../data/types';
import { fitMilestoneLabels, MILESTONE_LABEL_GAP, MILESTONE_RADIUS, MILESTONES, milestonePlaces } from './milestones';

function event(id: string, year: number): TimelineEvent {
  return {
    id,
    name: id,
    type: 'point',
    placement: 'udalosti',
    tagId: null,
    start: { year, month: null, day: null, approx: false, qualifier: null },
    end: null,
    source: null,
    note: null,
    placeName: null,
    lat: null,
    lng: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('klíčové události', () => {
  it('ukazují se jen ty, jejichž záznam existuje, seřazené podle času', () => {
    const [prvni, druha] = MILESTONES;
    const places = milestonePlaces([event(druha.eventId, -2369), event(prvni.eventId, -4025), event('jiny', 0)]);
    expect(places.map((place) => place.key)).toEqual([prvni.key, druha.key]);
  });

  it('popisek se ukáže, jen když nezajede do dalšího odznaku', () => {
    const width = 80;
    const need = MILESTONE_RADIUS + MILESTONE_LABEL_GAP + width + MILESTONE_RADIUS + MILESTONE_LABEL_GAP;
    expect(fitMilestoneLabels([0, need], [width, width])).toEqual([true, true]);
    expect(fitMilestoneLabels([0, need - 1], [width, width])).toEqual([false, true]);
  });

  it('pořadí na vstupu nehraje roli', () => {
    expect(fitMilestoneLabels([500, 0], [80, 80])).toEqual([true, true]);
    expect(fitMilestoneLabels([50, 0], [80, 80])).toEqual([true, false]);
  });
});
