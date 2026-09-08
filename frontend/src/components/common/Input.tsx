import {
  forwardRef,
  useId,
  useState,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from 'react';

type BaseInputProps = {
  label?: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
  icon?: ReactNode;
};

// Every field here forwards its ref. react-hook-form's `register()` returns a
// `ref` callback alongside `name`/`onChange`/`onBlur`, and call sites spread the
// whole object onto these components — without forwardRef React 18 drops the ref
// silently and RHF loses focus-on-error and scroll-to-error.
//
// Each label is tied to its control with a generated id so clicking the label
// focuses the field and screen readers announce the two together. `rest.id`
// still wins when a caller supplies one.

export const TextInput = forwardRef<
  HTMLInputElement,
  BaseInputProps & InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ label, error, hint, className = '', icon, ...rest }, ref) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {rest.required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          // Sizing and colour come from the caller's own icon element; this only
          // positions it and supplies a fallback colour.
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-ink-subtle">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          className={`w-full rounded-md border ${
            icon ? 'pl-9 pr-3' : 'px-3'
          } py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-paper ${
            error
              ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600'
              : 'border-paper-border focus:border-forum-600 focus:ring-forum-600'
          }`}
          {...rest}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  BaseInputProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ label, error, hint, className = '', icon: _icon, rows = 4, ...rest }, ref) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {rest.required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        rows={rows}
        className={`w-full rounded-md border px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-paper ${
          error
            ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600'
            : 'border-paper-border focus:border-forum-600 focus:ring-forum-600'
        }`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
});

export const SelectInput = forwardRef<
  HTMLSelectElement,
  BaseInputProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }
>(function SelectInput({ label, error, hint, className = '', icon: _icon, children, ...rest }, ref) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {rest.required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-md border bg-paper-raised px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-paper ${
          error
            ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600'
            : 'border-paper-border focus:border-forum-600 focus:ring-forum-600'
        }`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  { label: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ label, className = '', ...rest }, ref) {
  return (
    <label className={`flex items-start gap-2.5 ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-paper-border text-forum-600 focus:ring-forum-600"
        {...rest}
      />
      <span className="text-sm text-ink-muted">{label}</span>
    </label>
  );
});

export const FileInput = forwardRef<
  HTMLInputElement,
  BaseInputProps & InputHTMLAttributes<HTMLInputElement> & {
    /** Receives dropped files. Without it the drop zone is click-only. */
    onFiles?: (files: FileList) => void;
  }
>(function FileInput({ label, error, hint, className = '', icon: _icon, accept, onFiles, ...rest }, ref) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;
  const [dragging, setDragging] = useState(false);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {rest.required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      {/*
        The whole dashed area is the label, so clicking anywhere in it opens the
        picker — previously only the "Upload a file" text was clickable, which
        read as a dead control.
      */}
      <label
        htmlFor={id}
        onDragOver={(event) => { if (onFiles) { event.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (!onFiles) return;
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files?.length) onFiles(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer justify-center rounded-md border-2 border-dashed bg-paper px-6 py-8 transition-colors focus-within:border-forum-600 ${
          dragging ? 'border-forum-600 bg-forum-50' : 'border-paper-border hover:border-forum-400'
        }`}
      >
        <div className="text-center">
          <svg
            className="mx-auto h-10 w-10 text-ink-subtle"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div className="mt-3 flex text-sm text-ink-muted">
            <span className="font-medium text-forum-600">Upload a file</span>
            <p className="pl-1">or drag and drop</p>
          </div>
          {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
        </div>
        <input
          ref={ref}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          {...rest}
        />
      </label>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
});
