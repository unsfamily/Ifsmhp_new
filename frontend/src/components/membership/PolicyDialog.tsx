import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { PolicySections, policyDocument } from '../../pages/public/PolicyPage';

export default function PolicyDialog({
  slug,
  onClose,
}: {
  slug: 'terms-of-service' | 'code-of-ethics';
  onClose: () => void;
}) {
  const policy = policyDocument(slug);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[min(40rem,90vh)] overflow-y-auto rounded-lg border border-paper-border bg-paper-raised p-6 text-ink shadow-xl backdrop:bg-forum-900/50"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slateteal-700">IFSMHP Policies</p>
          <h2 id={titleId} className="mt-1 font-display text-xl font-semibold text-forum-900">{policy.title}</h2>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-ink-subtle hover:bg-paper hover:text-forum-900"
          aria-label={`Close ${policy.title}`}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">{policy.intro}</p>
      <div className="mt-5">
        <PolicySections policy={policy} compact />
      </div>
    </dialog>
  );
}
