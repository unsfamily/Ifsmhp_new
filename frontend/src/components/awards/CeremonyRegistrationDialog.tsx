import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  CeremonyRegistrationFields,
  CeremonyRegistrationNotices,
  CeremonyRegistrationSubmit,
  CeremonyRegistrationSuccess,
  useCeremonyRegistration,
} from './CeremonyRegistrationForm';

const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog for ceremony interest registration.
 * Uses the native dialog element, as the document-exchange modal does, and adds
 * focus return, a scroll lock, and a nearly full-screen layout on small screens.
 */
export default function CeremonyRegistrationDialog({
  open,
  onClose,
  returnFocusId,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const registration = useCeremonyRegistration();
  const { submitting, submitted, submit, submittingRef, reset } = registration;
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-title]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!submittingRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => element.tabIndex !== -1);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const activeInside = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey) {
        if (activeInside <= 0) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeInside < 0 || activeInside >= items.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (!submittingRef.current) onCloseRef.current();
    };
    dialog.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('cancel', onCancel);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      document.getElementById(returnFocusId)?.focus();
    };
  }, [open, returnFocusId, submittingRef]);

  useEffect(() => {
    if (open && submitted) document.getElementById('ceremony-registration-success')?.focus();
    if (!open && submitted) reset();
  }, [open, submitted, reset]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="ceremony-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submittingRef.current) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-paper-border px-4 py-4 sm:px-5">
        <h2 id={titleId} data-dialog-title tabIndex={-1} className="font-display text-xl font-semibold text-forum-900 outline-none">
          Register for the Ceremony
        </h2>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-600 disabled:opacity-50"
          aria-disabled={submitting}
          onClick={() => { if (!submitting) onClose(); }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Close
        </button>
      </div>

      {submitted ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-5">
          <CeremonyRegistrationSuccess />
        </div>
      ) : (
        <form id="ceremony-registration-form" noValidate onSubmit={(event) => { void submit(event); }} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <CeremonyRegistrationNotices />
          {registration.formError && <p role="alert" className="mt-4 rounded-lg border border-danger-600/20 bg-danger-100 px-4 py-3 text-sm text-danger-600">{registration.formError}</p>}
          <CeremonyRegistrationFields registration={registration} />
        </form>
      )}

      {!submitted && (
        <div className="border-t border-paper-border px-4 py-4 sm:px-5">
          <CeremonyRegistrationSubmit formId="ceremony-registration-form" submitting={submitting} className="w-full" />
        </div>
      )}
    </dialog>
  );
}
