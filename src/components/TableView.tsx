/**
 * Tabulkový přehled – rychlejší cesta pro hromadné zadávání než klikání po ose.
 * Třídění, fulltextové hledání a filtr podle kategorie; řádek otevře stejný
 * editační formulář jako osa.
 */

import { useMemo, useState } from 'react';
import { cs } from '../i18n/cs';
import { formatTimePoint } from '../lib/format';
import { compareTimePoints } from '../lib/time';
import type { Category, TimelineEvent } from '../data/types';
import { NO_CATEGORY_COLOR } from './timeline/layout';

type SortKey = 'name' | 'category' | 'start' | 'end' | 'type';
type SortDirection = 'asc' | 'desc';

interface Props {
  events: TimelineEvent[];
  categories: Category[];
  categoryMap: Map<string, Category>;
  canEdit: boolean;
  onOpen: (event: TimelineEvent) => void;
  onCreate: () => void;
  onShowOnTimeline: (event: TimelineEvent) => void;
}

const NO_CATEGORY_FILTER = '__none__';

export function TableView({
  events,
  categories,
  categoryMap,
  canEdit,
  onOpen,
  onCreate,
  onShowOnTimeline,
}: Props) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('start');
  const [direction, setDirection] = useState<SortDirection>('asc');

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('cs');
    return events.filter((event) => {
      if (categoryFilter === NO_CATEGORY_FILTER && event.categoryId !== null) return false;
      if (categoryFilter !== '' && categoryFilter !== NO_CATEGORY_FILTER && event.categoryId !== categoryFilter) {
        return false;
      }
      if (needle === '') return true;
      const haystack = [
        event.name,
        event.source ?? '',
        event.note ?? '',
        event.placeName ?? '',
        ...event.tags,
      ]
        .join(' ')
        .toLocaleLowerCase('cs');
      return haystack.includes(needle);
    });
  }, [events, query, categoryFilter]);

  const sorted = useMemo(() => {
    const factor = direction === 'asc' ? 1 : -1;
    const categoryName = (event: TimelineEvent) =>
      event.categoryId ? (categoryMap.get(event.categoryId)?.name ?? '') : '';
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return factor * a.name.localeCompare(b.name, 'cs');
        case 'category':
          return factor * categoryName(a).localeCompare(categoryName(b), 'cs');
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
  }, [filtered, sortKey, direction, categoryMap]);

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
          <label className="toolbar-label" htmlFor="table-category">
            {cs.table.filterCategory}
          </label>
          <select
            id="table-category"
            className="input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{cs.app.all}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value={NO_CATEGORY_FILTER}>{cs.timeline.withoutCategory}</option>
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
              {header('category', cs.table.colCategory)}
              {header('start', cs.table.colStart)}
              {header('end', cs.table.colEnd)}
              {header('type', cs.table.colType)}
              <th scope="col" className="table-tags">
                {cs.table.colTags}
              </th>
              <th scope="col" className="table-actions" aria-label={cs.table.showOnTimeline} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  {cs.table.empty}
                </td>
              </tr>
            ) : (
              sorted.map((event) => {
                const category = event.categoryId ? categoryMap.get(event.categoryId) : undefined;
                return (
                  <tr key={event.id} onClick={() => onOpen(event)} tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onOpen(event);
                      }}>
                    <td className="table-name">{event.name}</td>
                    <td>
                      <span className="table-category">
                        <span
                          className="legend-swatch"
                          style={{ background: category?.color ?? NO_CATEGORY_COLOR }}
                        />
                        {category?.name ?? cs.timeline.withoutCategory}
                      </span>
                    </td>
                    <td className="table-date">{formatTimePoint(event.start)}</td>
                    <td className="table-date">{event.end ? formatTimePoint(event.end) : ''}</td>
                    <td>{event.type === 'range' ? cs.form.typeRange : cs.form.typePoint}</td>
                    <td className="table-tags">
                      <span className="tag-list">
                        {event.tags.map((tag) => (
                          <span key={tag} className="tag tag-small">
                            {tag}
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
