/**
 * Formulář záznamu (modál). Veškerá editace jde přes formulář – na ose se
 * nic nepřetahuje. Rok se zadává jako kladné číslo + éra, nikdy jako
 * astronomická hodnota; převod obstará validace.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { cs } from '../i18n/cs';
import { formatRange } from '../lib/format';
import { fromAstronomicalYear, type Era, type TimePoint } from '../lib/time';
import {
  emptyEventForm,
  validateEventForm,
  type EventFormInput,
  type FieldErrors,
  type TimeInput,
} from '../lib/validation';
import type { Category, EventDraft, TimelineEvent } from '../data/types';
import { Field, Modal } from './ui';

interface Props {
  event: TimelineEvent | null;
  categories: Category[];
  onSubmit: (draft: EventDraft) => Promise<void>;
  onClose: () => void;
  onManageCategories: () => void;
}

function timePointToInput(tp: TimePoint | null): TimeInput {
  if (!tp) return { year: '', era: 'bc', month: '', day: '', approx: false };
  const { year, era } = fromAstronomicalYear(tp.year);
  return {
    year: String(year),
    era,
    month: tp.month === null ? '' : String(tp.month),
    day: tp.day === null ? '' : String(tp.day),
    approx: tp.approx,
  };
}

function eventToInput(event: TimelineEvent | null): EventFormInput {
  if (!event) return emptyEventForm();
  return {
    name: event.name,
    type: event.type,
    categoryId: event.categoryId,
    start: timePointToInput(event.start),
    end: event.end ? timePointToInput(event.end) : timePointToInput(null),
    source: event.source ?? '',
    note: event.note ?? '',
    placeName: event.placeName ?? '',
    lat: event.lat === null ? '' : String(event.lat),
    lng: event.lng === null ? '' : String(event.lng),
    tags: [...event.tags],
  };
}

export function EventForm({ event, categories, onSubmit, onClose, onManageCategories }: Props) {
  const [input, setInput] = useState<EventFormInput>(() => eventToInput(event));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  const preview = useMemo(() => {
    const result = validateEventForm(input);
    return result.ok ? formatRange(result.value.start, result.value.end) : null;
  }, [input]);

  const patch = (changes: Partial<EventFormInput>) => setInput((prev) => ({ ...prev, ...changes }));
  const patchTime = (which: 'start' | 'end', changes: Partial<TimeInput>) =>
    setInput((prev) => ({ ...prev, [which]: { ...prev[which], ...changes } }));

  const addTag = () => {
    const value = tagDraft.trim();
    if (value === '') return;
    if (!input.tags.includes(value)) patch({ tags: [...input.tags, value] });
    setTagDraft('');
  };

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

          <Field label={cs.form.category} htmlFor="event-category">
            <div className="category-row">
              <select
                id="event-category"
                className="input"
                value={input.categoryId ?? ''}
                onChange={(e) => patch({ categoryId: e.target.value === '' ? null : e.target.value })}
              >
                <option value="">{cs.form.categoryNone}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button type="button" className="link-button" onClick={onManageCategories}>
                {cs.form.manageCategories}
              </button>
            </div>
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

        <Field label={cs.form.tags} htmlFor="event-tags" optional>
          <div className="tag-editor">
            {input.tags.map((tag) => (
              <span key={tag} className="tag tag-editable">
                {tag}
                <button
                  type="button"
                  className="tag-remove"
                  aria-label={cs.form.tagRemove(tag)}
                  onClick={() => patch({ tags: input.tags.filter((t) => t !== tag) })}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="event-tags"
              className="input tag-input"
              value={tagDraft}
              placeholder={cs.form.tagsPlaceholder}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
            />
          </div>
        </Field>
      </form>
    </Modal>
  );
}
