import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { CEREMONY_NOMINATE_PATH, CEREMONY_NOMINATE_URL, CEREMONY_PUBLIC_ORIGIN } from '../../domain/ceremonyRegistration';

export function ceremonyRegistrationUrl(path = CEREMONY_NOMINATE_PATH) {
  return `${CEREMONY_PUBLIC_ORIGIN}${path}`;
}

export default function CeremonyRegistrationQr() {
  const url = CEREMONY_NOMINATE_URL;
  const hostRef = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const host = hostRef.current;
    QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      width: 196,
      errorCorrectionLevel: 'M',
      color: { dark: '#012559', light: '#ffffff' },
    }).then((markup) => {
      if (!active || !host) return;
      const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
      const svg = parsed.documentElement;
      host.replaceChildren();
      if (svg.tagName.toLowerCase() === 'svg') {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `QR code for ${url}`);
        host.appendChild(document.importNode(svg, true));
        setReady(true);
      }
    }).catch(() => {
      if (active) setReady(false);
    });
    return () => { active = false; };
  }, [url]);

  return (
    <div className="flex flex-col items-center text-center" data-registration-url={url}>
      <Link
        to={CEREMONY_NOMINATE_PATH}
        className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-paper-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-600"
        aria-label="Open the award nomination form"
      >
        <span ref={hostRef} className={`block h-[196px] w-[196px] [&>svg]:h-full [&>svg]:w-full ${ready ? '' : 'sr-only'}`} />
        {!ready && <span className="flex h-[196px] w-[196px] items-center justify-center text-sm text-ink-muted">Preparing QR code</span>}
      </Link>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        Scan this code to open the award nomination form.
      </p>
      <p className="mt-2 break-all text-xs text-ink-subtle">{url}</p>
    </div>
  );
}
