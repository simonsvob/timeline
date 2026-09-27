/**
 * Hledání záznamu podle jména s našeptávačem. Sedí v hlavičce, aby nezabíralo
 * místo nad osou — používá se občas, ne pořád.
 *
 * Na úzké obrazovce se pole schová do kulatého tlačítka a po klepnutí se
 * rozbalí přes celý řádek hlavičky. Jinak by hlavička na telefonu narostla
 * o celý řádek, který se skoro nepoužívá.
 */

import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { cs } from '../i18n/cs';
import { formatYear } from '../lib/format';
import type { Tag, TimelineEvent } from '../data/types';
import { tagColor } from './timeline/layout';
import { SearchIcon } from './icons';

interface Props {
  events: TimelineEvent[];
  tagMap: Map<string, Tag>;
  onPick: (event: TimelineEvent) => void;
}

export function SearchBox({ events, tagMap, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  /** rozbalené pole – na široké obrazovce ho CSS ukazuje vždy */
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const expand = () => {
    // Safari na iOS ukáže klávesnici, jen když focus přijde přímo z klepnutí.
    // Pole proto musí být vidět ještě v téhle obsluze, ne až po překreslení.
    flushSync(() => setExpanded(true));
    inputRef.current?.focus();
  };

  const suggestions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('cs');
    if (needle === '') return [];
    return events
      .filter((event) => event.name.toLocaleLowerCase('cs').includes(needle))
      .slice(0, 8);
  }, [events, query]);

  return (
    <div className={`search${expanded ? ' search-expanded' : ''}`}>
      <button
        type="button"
        className="icon-button search-toggle"
        onClick={expand}
        aria-label={cs.nav.search}
        title={cs.nav.search}
        aria-expanded={expanded}
      >
        <SearchIcon />
      </button>
      <div className="search-field">
        <span className="search-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          value={query}
          placeholder={cs.timeline.searchPlaceholder}
          aria-label={cs.timeline.searchPlaceholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() =>
            window.setTimeout(() => {
              setOpen(false);
              setExpanded(false);
            }, 150)
          }
          onKeyDown={(e) => {
            if (e.key === 'Escape') inputRef.current?.blur();
          }}
        />
        {open && query.trim() !== '' ? (
          <ul className="suggestions">
            {suggestions.length === 0 ? (
              <li className="suggestion-empty">{cs.timeline.noSearchResults}</li>
            ) : (
              suggestions.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className="suggestion"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(event);
                      setOpen(false);
                      inputRef.current?.blur();
                    }}
                  >
                    <span
                      className="suggestion-color"
                      style={{ background: tagColor(event.tagId, tagMap) }}
                    />
                    <span className="suggestion-name">{event.name}</span>
                    <span className="suggestion-year">{formatYear(event.start.year)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Zámek v hlavičce: zavřený = jen prohlížení, otevřený = přihlášeno. */
export function LockButton({ unlocked, onClick }: { unlocked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`icon-button${unlocked ? ' icon-button-strong' : ''}`}
      onClick={onClick}
      aria-label={unlocked ? cs.auth.signOut : cs.auth.signIn}
      title={unlocked ? cs.auth.signOut : cs.auth.signIn}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <rect x="4" y="10.5" width="16" height="10.5" rx="2.6" />
        {unlocked ? (
          // odemčeno – třmen odklopený doprava
          <path d="M8 10.5V7a4 4 0 0 1 7.7-1.5" strokeLinecap="round" />
        ) : (
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
