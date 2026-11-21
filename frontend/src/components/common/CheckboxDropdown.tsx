import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type CheckboxDropdownProps = {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  max?: number;
  limitMessage?: string;
  placeholder?: string;
};

export default function CheckboxDropdown({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  required = false,
  max = 2,
  limitMessage = 'You can choose only two.',
  placeholder = 'Select up to two awards',
}: CheckboxDropdownProps) {
  const generatedId = useId();
  const id = generatedId;
  const labelId = `${id}-label`;
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const atLimit = value.length >= max;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, option]);
  };

  return (
    <div ref={panelRef} className="relative">
      <label id={labelId} htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-danger-600">*</span>}
      </label>
      <button
        id={id}
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`flex w-full items-center justify-between gap-3 rounded-md border bg-paper-raised px-3 py-2.5 text-left text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-paper ${
          error
            ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600'
            : 'border-paper-border focus:border-forum-600 focus:ring-forum-600'
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`min-w-0 break-words ${value.length ? 'text-ink' : 'text-ink-subtle'}`}>
          {value.length ? value.join('; ') : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div role="group" aria-labelledby={labelId} className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-paper-border bg-paper-raised p-2 shadow-lg">
          {atLimit && <p className="px-2 py-1 text-xs text-ink-muted">{limitMessage}</p>}
          {options.map((option) => {
            const checked = value.includes(option);
            const disabled = !checked && atLimit;
            return (
              <label key={option} className={`flex items-start gap-2.5 rounded px-2 py-1.5 text-sm ${disabled ? 'text-ink-subtle' : 'text-ink'}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-paper-border text-forum-600 focus:ring-forum-600 disabled:opacity-40"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(option)}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      )}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger-600">{error}</p>}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
