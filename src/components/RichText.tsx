/**
 * Text se zaktivněnými odkazy — používá se u zdroje a poznámky.
 *
 * Rozpoznávání je v `lib/links.ts`; tady se jen kreslí. Klik na odkaz se
 * nesmí prohnat dál: v tabulce leží text v řádku, který otevírá formulář.
 */

import { parseLinks } from '../lib/links';

export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseLinks(text).map((segment, index) =>
        segment.kind === 'link' ? (
          <a
            key={index}
            className="text-link"
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {segment.text}
          </a>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
