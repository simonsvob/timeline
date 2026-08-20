/**
 * Formulář záznamu (modál). Veškerá editace jde přes formulář – na ose se
 * nic nepřetahuje. Rok se zadává jako kladné číslo + éra, nikdy jako
 * astronomická hodnota; převod obstará validace.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { cs } from '../i18n/cs';
import { formatRange } from '../lib/format';
import { fromAstronomicalYear, type Era, type Qualifier, type TimePoint } from '../lib/time';
import {
  emptyEventForm,
  validateEventForm,
  type EventFormInput,
  type FieldErrors,
  type TimeInput,
} from '../lib/validation';
import { PLACEMENTS, type EventDraft, type Tag, type TimelineEvent } from '../data/types';
import { Field, Modal } from './ui';

interface Props {
  event: TimelineEvent | null;
  tags: Tag[];
  onSubmit: (draft: EventDraft) => Promise<void>;
  onClose: () => void;
}

function timePointToInput(tp: TimePoint | null): TimeInput {
  if (!tp) return { year: '', era: 'bc', month: '', day: '', approx: false, qualifier: '' };
  const { year, era } = fromAstronomicalYear(tp.year);
  return {
    year: String(year),
    era,
    month: tp.month === null ? '' : String(tp.month),
    day: tp.day === null ? '' : String(tp.day),
    approx: tp.approx,
    qualifier: tp.qualifier ?? '',
  };
}

function eventToInput(event: TimelineEvent | null): EventFormInput {
  if (!event) return emptyEventForm();
  return {
    name: event.name,
    type: event.type,
    placement: event.placement,
    tagId: event.tagId,
    start: timePointToInput(event.start),
    end: event.end ? timePointToInput(event.end) : timePointToInput(null),
    source: event.source ?? '',
    note: event.note ?? '',
    placeName: event.placeName ?? '',
    lat: event.lat === null ? '' : String(event.lat),
    lng: event.lng === null ? '' : String(event.lng),
  };
}

export function EventForm({ event, tags, onSubmit, onClose }: Props) {
  const [input, setInput] = useState<EventFormInput>(() => eventToInput(event));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const result = validateEventForm(input);
    return result.ok ? formatRange(result.value.start, result.value.end) : null;
  }, [input]);

  const patch = (changes: Partial<EventFormInput>) => setInput((prev) => ({ ...prev, ...changes }));
  const patchTime = (which: 'start' | 'end', changes: Partial<TimeInput>) =>
    setInput((prev) => ({ ...prev, [which]: { ...prev[which], ...changes } }));

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    const result = validateEventForm(input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(result.value);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : cs.form.saveError);
    } finally {
      setSubmitting(false);
    }
  };

  const timeGroup = (which: 'start' | 'end', legend: string) => {
    const value = input[which];
    return (
      <fieldset className="time-group">
        <legend>{legend}</legend>
        <div className="time-row">
          <Field label={cs.form.year} htmlFor={`${which}-year`} error={errors[`${which}.year`]}>
            <input
              id={`${which}-year`}
              className="input input-year"
              type="number"
              min={1}
              inputMode="numeric"
              value={value.year}
              onChange={(e) => patchTime(which, { year: e.target.value })}
            />
          </Field>

          <div className="field">
            <span className="field-label-static">{cs.form.era}</span>
            <div className="segmented">
              {(['bc', 'ad'] as Era[]).map((era) => (
                <button
                  key={era}
                  type="button"
                  className={`segment${value.era === era ? ' segment-active' : ''}`}
                  onClick={() => patchTime(which, { era })}
                  aria-pressed={value.era === era}
                >
                  {era === 'bc' ? cs.era.bc : cs.era.ad}
                </button>
              ))}
            </div>
          </div>

          <Field label={cs.form.month} htmlFor={`${which}-month`} error={errors[`${which}.month`]} optional>
            <select
              id={`${which}-month`}
              className="input"
              value={value.month}
              onChange={(e) =>
                patchTime(which, { month: e.target.value, day: e.target.value === '' ? '' : value.day })
              }
            >
              <option value="">{cs.form.monthNone}</option>
              {cs.months.nominative.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={cs.form.day} htmlFor={`${which}-day`} error={errors[`${which}.day`]} optional>
            <input
              id={`${which}-day`}
              className="input input-day"
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              value={value.day}
              disabled={value.month === ''}
              onChange={(e) => patchTime(which, { day: e.target.value })}
            />
          </Field>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={value.approx}
            onChange={(e) => patchTime(which, { approx: e.target.checked })}
          />
          <span>
            {cs.form.approx}
            <span className="field-hint-inline"> — {cs.form.approxHint}</span>
          </span>
        </label>

        <Field
          label={cs.qualifier.openEnd}
          htmlFor={`${which}-qualifier`}
          hint={cs.qualifier.openEndHint}
          optional
        >
          <select
            id={`${which}-qualifier`}
            className="input"
            value={value.qualifier}
            onChange={(e) => patchTime(which, { qualifier: e.target.value as Qualifier | '' })}
          >
            <option value="">{cs.qualifier.none}</option>
            <option value="min">{cs.qualifier.minLabel}</option>
            <option value="after">{cs.qualifier.afterLabel}</option>
            <option value="before">{cs.qualifier.beforeLabel}</option>
          </select>
        </Field>
      </fieldset>
    );
  };

  return (
    <Modal
      title={event ? cs.form.editTitle : cs.form.newTitle}
      onClose={onClose}
      wide
      footer={
        <>
          {submitError ? <span className="form-error">{submitError}</span> : null}
          {preview ? (
            <span className="form-preview">
              {cs.form.preview}: <strong>{preview}</strong>
            </span>
          ) : null}
          <button type="button" className="button" onClick={onClose}>
            {cs.app.cancel}
          </button>
          <button type="submit" form="event-form" className="button button-primary" disabled={submitting}>
            {submitting ? cs.app.saving : cs.app.save}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="form">
        <Field label={cs.form.name} htmlFor="event-name" error={errors.name}>
          <input
            id="event-name"
            className="input"
            value={input.name}
            placeholder={cs.form.namePlaceholder}
            onChange={(e) => patch({ name: e.target.value })}
            autoFocus
          />
        </Field>

        <div className="form-row">
          <div className="field">
            <span className="field-label-static">{cs.form.type}</span>
            <div className="segmented">
              <button
                type="button"
                className={`segment${input.type === 'point' ? ' segment-active' : ''}`}
                onClick={() => patch({ type: 'point' })}
                aria-pressed={input.type === 'point'}
              >
                {cs.form.typePoint}
              </button>
              <button
                type="button"
                className={`segment${input.type === 'range' ? ' segment-active' : ''}`}
                onClick={() => patch({ type: 'range' })}
                aria-pressed={input.type === 'range'}
              >
                {cs.form.typeRange}
              </button>
            </div>
          </div>

          <Field label={cs.form.placement} htmlFor="event-placement" hint={cs.form.placementHint}>
            <select
              id="event-placement"
              className="input"
              value={input.placement}
              onChange={(e) => patch({ placement: e.target.value as EventFormInput['placement'] })}
            >
              {PLACEMENTS.map((placement) => (
                <option key={placement} value={placement}>
                  {cs.timeline.bands[placement]}
                </option>
              ))}
            </select>
          </Field>

        </div>

        <div className="form-row">
          <Field label={cs.form.tag} htmlFor="event-tag" hint={cs.form.tagHint}>
            <select
              id="event-tag"
              className="input"
              value={input.tagId ?? ''}
              onChange={(e) => patch({ tagId: e.target.value === '' ? null : e.target.value })}
            >
              <option value="">{cs.form.tagNone}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {timeGroup('start', input.type === 'range' ? cs.form.start : cs.detail.when)}
        {input.type === 'range' ? timeGroup('end', cs.form.end) : null}

        <Field label={cs.form.source} htmlFor="event-source" optional>
          <input
            id="event-source"
            className="input"
            value={input.source}
            placeholder={cs.form.sourcePlaceholder}
            onChange={(e) => patch({ source: e.target.value })}
          />
        </Field>

        <Field label={cs.form.note} htmlFor="event-note" optional>
          <textarea
            id="event-note"
            className="input textarea"
            rows={3}
            value={input.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </Field>

        <div className="form-row">
          <Field label={cs.form.place} htmlFor="event-place" optional>
            <input
              id="event-place"
              className="input"
              value={input.placeName}
              placeholder={cs.form.placePlaceholder}
              onChange={(e) => patch({ placeName: e.target.value })}
            />
          </Field>
          <Field label={cs.form.lat} htmlFor="event-lat" error={errors.lat} optional>
            <input
              id="event-lat"
              className="input"
              inputMode="decimal"
              value={input.lat}
              onChange={(e) => patch({ lat: e.target.value })}
            />
          </Field>
          <Field label={cs.form.lng} htmlFor="event-lng" error={errors.lng} optional>
            <input
              id="event-lng"
              className="input"
              inputMode="decimal"
              value={input.lng}
              onChange={(e) => patch({ lng: e.target.value })}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
