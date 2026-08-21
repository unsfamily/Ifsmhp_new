import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

type BaseInputProps = {
  label?: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
  icon?: ReactNode;
};

export function TextInput({
  label,
  error,
  hint,
  className = '',
  ...rest
}: BaseInputProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {rest.required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      <input
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
}

export function TextArea({
  label,
  error,
  hint,
  className = '',
  rows = 4,
  ...rest
}: BaseInputProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {rest.required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      <textarea
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
}

export function SelectInput({
  label,
  error,
  hint,
  className = '',
  children,
  ...rest
}: BaseInputProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {rest.required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      <select
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
}

export function Checkbox({
  label,
  className = '',
  ...rest
}: { label: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex items-start gap-2.5 ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-paper-border text-forum-600 focus:ring-forum-600"
        {...rest}
      />
      <span className="text-sm text-ink-muted">{label}</span>
    </label>
  );
}

export function FileInput({
  label,
  error,
  hint,
  className = '',
  accept,
  ...rest
}: BaseInputProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {rest.required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      <div className="flex justify-center rounded-md border-2 border-dashed border-paper-border bg-paper px-6 py-8 transition-colors hover:border-forum-400">
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
            <label className="relative cursor-pointer rounded-md font-medium text-forum-600 hover:text-forum-700 focus-within:outline-none">
              <span>Upload a file</span>
              <input
                type="file"
                accept={accept}
                className="sr-only"
                {...rest}
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}
