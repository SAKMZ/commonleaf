'use client';

import { useId } from 'react';

/**
 * The four kinds of control the settings screen needs.
 *
 * Handwritten rather than pulled from a component library: there are four of
 * them, they are twenty lines each, and every library that could supply them
 * would also supply a look this project is deliberately not going for.
 */

export function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-rule border-t pt-6">
      <legend className="index-heading pe-3">{legend}</legend>
      {description && <p className="text-ink-muted -mt-1 mb-5 text-sm italic">{description}</p>}
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-start justify-between gap-6">
      <span className="min-w-0">
        <label htmlFor={id} className="block">
          {label}
        </label>
        {hint && <span className="text-ink-faint block text-sm">{hint}</span>}
      </span>

      {/*
       * A real checkbox, styled — not a div pretending to be one. It arrives
       * with the keyboard behaviour, the focus ring and the announcement
       * already correct.
       */}
      <input
        id={id}
        type="checkbox"
        className="accent-accent mt-1 h-4 w-4 flex-none"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Turns the raw number into something worth reading, e.g. `19px`. */
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id}>{label}</label>
        <span className="text-ink-faint text-sm tabular-nums">{format(value)}</span>
      </div>

      <input
        id={id}
        type="range"
        className="accent-accent mt-2 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { readonly id: T; readonly label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-baseline justify-between gap-6">
      <label htmlFor={id}>{label}</label>

      <select
        id={id}
        className="border-rule bg-paper max-w-[60%] border px-2 py-1"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
