import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { UpiPayment } from '../../services/membershipService';

const SIZE = 148;
type QrState = 'loading' | 'ready' | 'failed';

/**
 * True only when the link is a UPI payment link that pays exactly the UPI ID, payee and amount shown
 * beside it, in INR, and nothing else. The server builds both, so a mismatch means a faulty response.
 */
function linkMatchesDetails(payment: UpiPayment): boolean {
  const prefix = 'upi://pay?';
  if (typeof payment.uri !== 'string' || !payment.uri.startsWith(prefix)) return false;
  const params = new URLSearchParams(payment.uri.slice(prefix.length));
  return [...params.keys()].join(',') === 'pa,pn,am,cu'
    && params.get('pa') === payment.upiId
    && params.get('pn') === payment.payeeName
    && params.get('am') === payment.amount
    && params.get('cu') === 'INR';
}

/** QR code that opens a UPI app with the payee and amount already filled in. It records nothing; the applicant still submits a UTR and screenshot. */
export default function UpiPaymentQr({ payment, currency }: { payment: UpiPayment; currency: string }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<QrState>('loading');
  const { uri, upiId, payeeName, amount } = payment;
  const valid = currency === 'INR' && linkMatchesDetails({ uri, upiId, payeeName, amount });

  useEffect(() => {
    if (!valid) return;
    let active = true;
    const host = hostRef.current;
    setState('loading');
    QRCode.toString(uri, {
      type: 'svg',
      margin: 2,
      width: SIZE,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((markup) => {
      if (!active || !host) return;
      const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
      host.replaceChildren();
      if (svg.tagName.toLowerCase() !== 'svg') { setState('failed'); return; }
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `UPI QR code to pay ${currency} ${amount} to ${payeeName}`);
      host.appendChild(document.importNode(svg, true));
      setState('ready');
    }).catch(() => {
      if (!active) return;
      host?.replaceChildren();
      setState('failed');
    });
    return () => { active = false; };
  }, [uri, valid, currency, amount, payeeName]);

  if (!valid) return null;
  return (
    <div data-testid="upi-payment-qr" aria-live="off" className="mt-3 flex shrink-0 flex-col items-center text-center sm:mt-0 sm:w-48">
      <span className="rounded-lg bg-white p-1.5 ring-1 ring-paper-border">
        <span ref={hostRef} style={{ width: SIZE, height: SIZE }} className={`block [&>svg]:h-full [&>svg]:w-full ${state === 'ready' ? '' : 'sr-only'}`} />
        {state === 'loading' && <span style={{ width: SIZE, height: SIZE }} className="flex items-center justify-center text-xs text-ink-muted">Preparing QR code</span>}
        {state === 'failed' && <span role="alert" style={{ width: SIZE, height: SIZE }} className="flex items-center justify-center px-2 text-xs text-danger-700">The QR code could not be drawn. Pay {currency} {amount} to the UPI ID below.</span>}
      </span>
      {state === 'ready' && <p className="mt-2 text-xs font-semibold text-ink">Scan with any UPI app to pay {currency} {amount}</p>}
      <p className="mt-1 text-xs text-ink">UPI ID<span className="block font-semibold [overflow-wrap:anywhere]">{upiId}</span></p>
      <p className="mt-1 text-xs text-ink-muted">Before you pay, check that your UPI app shows the payee as {payeeName}.</p>
      <a href={uri} className="mt-2 text-xs font-medium text-forum-700 underline sm:hidden">Open a UPI app on this phone</a>
    </div>
  );
}
