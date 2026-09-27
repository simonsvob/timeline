/**
 * Ikony kulatých tlačítek v hlavičce. Kreslí se stejně jako zámek: tah
 * 1,9 px v mřížce 24 × 24, bez výplně, barva z `currentColor` — tlačítko
 * tak ikoně řídí barvu i při najetí myší.
 */

const SIZE = 17;

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Icon>
  );
}

export function FilterIcon() {
  return (
    <Icon>
      <path d="M4.5 5.5h15l-5.8 6.9v5.4l-3.4 1.7v-7.1z" />
    </Icon>
  );
}

export function HelpIcon() {
  return (
    <Icon>
      <path d="M8.4 8.9a3.6 3.6 0 1 1 5.5 3.1c-1.1.7-1.9 1.5-1.9 2.9" />
      <circle cx="12" cy="18.7" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5.5v13M5.5 12h13" />
    </Icon>
  );
}
