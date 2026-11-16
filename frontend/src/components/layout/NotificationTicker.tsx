import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

const ROTATE_MS = 7000;

export function noticeLines(value: string | null | undefined) {
  return (value ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function NoticeText({ text }: { text: string }) {
  return <span className="notice-copy" aria-hidden="true">{text}</span>;
}

export default function NotificationTicker({ notices }: { notices: string }) {
  const lines = noticeLines(notices);
  const barRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = lines.length;
  const current = count ? index % count : 0;

  useEffect(() => {
    const bar = barRef.current;
    const root = document.documentElement;
    if (!bar) {
      root.style.setProperty('--public-notice-height', '0px');
      return;
    }
    const sync = () => {
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
      const remaining = Math.max(0, bar.getBoundingClientRect().bottom - headerBottom);
      root.style.setProperty('--public-notice-height', `${remaining}px`);
    };
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      root.style.setProperty('--public-notice-height', '0px');
    };
  }, [count, current]);

  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion()) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % count), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  const line = lines[current];
  if (!count || !line) return null;

  const showNotice = (delta: number) => setIndex(value => (value + delta + count) % count);

  return (
    <div ref={barRef} className={`notice-bar relative z-30${paused ? ' is-paused' : ''}`} role="region" aria-label="Notifications">
      <span className="notice-kicker">
        <span className="notice-beacon" aria-hidden="true" />
        Notice
      </span>
      {count > 1 && (
        <button type="button" className="notice-control" onClick={() => showNotice(-1)} aria-label="Previous notice">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <div className="notice-viewport">
        <p key={line} className="notice-sentence">
          <span className="sr-only">{line}</span>
          <NoticeText text={line} />
        </p>
        {count > 1 && (
          <span className="notice-count">
            {current + 1} / {count}
          </span>
        )}
      </div>
      {count > 1 && (
        <button type="button" className="notice-control" onClick={() => showNotice(1)} aria-label="Next notice">
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="notice-control"
        onClick={() => setPaused(value => !value)}
        aria-label={paused ? 'Play notifications' : 'Pause notifications'}
        aria-pressed={paused}
      >
        {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
    </div>
  );
}
