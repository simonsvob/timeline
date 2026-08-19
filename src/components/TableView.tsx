/**
 * Tabulkový přehled – rychlejší cesta pro hromadné zadávání než klikání po ose.
 * Třídění, fulltextové hledání a filtry podle štítku a umístění; řádek otevře
 * stejný editační formulář jako osa.
 */

import { useMemo, useState } from 'react';
import { cs } from '../i18n/cs';
import { formatTimePoint } from '../lib/format';
import { compareTimePoints } from '../lib/time';
import { PLACEMENTS, type Placement, type Tag, type TimelineEvent } from '../data/types';
import { tagColor } from './timeline/layout';

type SortKey = 'name' | 'tag' | 'placement' | 'start' | 'end' | 'type';
type SortDirection = 'asc' | 'desc';

interface Props {
  events: TimelineEvent[];
  tags: Tag[];
  tagMap: Map<string, Tag>;
  canEdit: boolean;
  onOpen: (event: TimelineEvent) => void;
  onCreate: () => void;
  onShowOnTimeline: (event: TimelineEvent) => void;
}

const NO_TAG_FILTER = '__none__';

export function TableView({
  events,
  tags,
  tagMap,
  canEdit,
  onOpen,
  onCreate,
  onShowOnTimeline,
}: Props) {
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [placementFilter, setPlacementFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('start');
  const [direction, setDirection] = useState<SortDirection>('asc');

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('cs');
    return events.filter((event) => {
      if (tagFilter === NO_TAG_FILTER && event.tagId !== null) return false;
      if (tagFilter !== '' && tagFilter !== NO_TAG_FILTER && event.tagId !== tagFilter) return false;
      if (placementFilter !== '' && event.placement !== placementFilter) return false;
      if (needle === '') return true;
      const haystack = [
        event.name,
        event.source ?? '',
        event.note ?? '',
        event.placeName ?? '',
        ...event.keywords,
      ]
        .join(' ')
        .toLocaleLowerCase('cs');
      return haystack.includes(needle);
    });
  }, [events, query, tagFilter, placementFilter]);

  const sorted = useMemo(() => {
    const factor = direction === 'asc' ? 1 : -1;
    const tagName = (event: TimelineEvent) =>
      event.tagId ? (tagMap.get(event.tagId)?.name ?? '') : '';
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return factor * a.name.localeCompare(b.name, 'cs');
        case 'tag':
          return factor * tagName(a).localeCompare(tagName(b), 'cs');
        case 'placement':
          return (
            factor *
            cs.timeline.bands[a.placement].localeCompare(cs.timeline.bands[b.placement], 'cs')
          );
        case 'type':
          return factor * a.type.localeCompare(b.type);
        case 'end': {
          if (!a.end && !b.end) return 0;
          if (!a.end) return 1;
          if (!b.end) return -1;
          return factor * compareTimePoints(a.end, b.end);
        }
        case 'start':
        default:
          return factor * compareTimePoints(a.start, b.start);
      }
    });
  }, [filtered, sortKey, direction, tagMap]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDirection('asc');
    }
  };

  const header = (key: SortKey, label: string) => (
    <th scope="col">
      <button type="button" className="table-sort" onClick={() => toggleSort(key)}>
        {label}
        <span className="table-sort-arrow" aria-hidden="true">
          {sortKey === key ? (direction === 'asc' ? '▲' : '▼') : ''}
        </span>
        <span className="visually-hidden">
          {sortKey === key ? (direction === 'asc' ? cs.table.sortAsc : cs.table.sortDesc) : ''}
        </span>
      </button>
    </th>
  );

  return (
    <div className="table-view">
      <div className="toolbar">
        <div className="toolbar-group toolbar-search">
          <input
            type="search"
            className="input"
            value={query}
            placeholder={cs.table.searchPlaceholder}
            aria-label={cs.table.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="toolbar-group">
          <label className="toolbar-label" htmlFor="table-tag">
            {cs.table.filterTag}
          </label>
          <select
            id="table-tag"
            className="input"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="">{cs.app.all}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
            <option value={NO_TAG_FILTER}>{cs.timeline.withoutTag}</option>
          </select>
        </div>
        <div className="toolbar-group">
          <label className="toolbar-label" htmlFor="table-placement">
            {cs.table.filterPlacement}
          </label>
          <select
            id="table-placement"
            className="input"
            value={placementFilter}
            onChange={(e) => setPlacementFilter(e.target.value)}
          >
            <option value="">{cs.app.all}</option>
            {PLACEMENTS.map((placement) => (
              <option key={placement} value={placement}>
                {cs.timeline.bands[placement]}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-group toolbar-right">
          <span className="muted">{cs.table.rowsInfo(sorted.length)}</span>
          {canEdit ? (
            <button type="button" className="button button-primary" onClick={onCreate}>
              {cs.table.newEvent}
            </button>
          ) : null}
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {header('name', cs.table.colName)}
              {header('tag', cs.table.colTag)}
              {header('placement', cs.table.colPlacement)}
              {header('start', cs.table.colStart)}
              {header('end', cs.table.colEnd)}
              {header('type', cs.table.colType)}
              <th scope="col" className="table-tags">
                {cs.table.colKeywords}
              </th>
              <th scope="col" className="table-actions" aria-label={cs.table.showOnTimeline} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  {cs.table.empty}
                </td>
              </tr>
            ) : (
              sorted.map((event) => {
                const tag = event.tagId ? tagMap.get(event.tagId) : undefined;
                return (
                  <tr key={event.id} onClick={() => onOpen(event)} tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onOpen(event);
                      }}>
                    <td className="table-name">{event.name}</td>
                    <td>
                      <span className="table-category">
                        <span
                          className="tag-swatch"
                          style={{ background: tagColor(event.tagId, tagMap) }}
                        />
                        {tag?.name ?? cs.timeline.withoutTag}
                      </span>
                    </td>
                    <td className="table-placement">
                      {cs.timeline.bands[event.placement as Placement]}
                    </td>
                    <td className="table-date">{formatTimePoint(event.start)}</td>
                    <td className="table-date">{event.end ? formatTimePoint(event.end) : ''}</td>
                    <td>{event.type === 'range' ? cs.form.typeRange : cs.form.typePoint}</td>
                    <td className="table-tags">
                      <span className="tag-list">
                        {event.keywords.map((keyword) => (
                          <span key={keyword} className="tag tag-small">
                            {keyword}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowOnTimeline(event);
                        }}
                      >
                        {cs.table.showOnTimeline}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
