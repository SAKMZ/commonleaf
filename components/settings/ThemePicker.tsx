'use client';

import { Check } from 'lucide-react';

import { themes } from '@/lib/theme/themes';

/**
 * Choosing the paper.
 *
 * Swatches rather than a dropdown: the names mean nothing until you have seen
 * them, and every swatch shows the three colours that actually matter — the
 * sheet, the ink on it, and the accent.
 */
export function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="index-heading mb-3">Paper</legend>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Swatch
          selected={value === 'system'}
          label="Follow the system"
          onSelect={() => onChange('system')}
          colors={null}
        />

        {themes.map((theme) => (
          <Swatch
            key={theme.id}
            selected={value === theme.id}
            label={theme.label}
            onSelect={() => onChange(theme.id)}
            colors={theme.colors}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Swatch({
  label,
  selected,
  colors,
  onSelect,
}: {
  label: string;
  selected: boolean;
  colors: { paper: string; ink: string; accent: string; paperEdge: string } | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="border-rule flex items-center gap-2.5 border p-2 text-start text-sm data-[selected=true]:border-current"
      data-selected={selected}
      style={selected ? { borderColor: 'var(--accent)' } : undefined}
    >
      {colors ? (
        <span
          aria-hidden="true"
          className="flex h-7 w-7 flex-none items-center justify-center border"
          style={{ backgroundColor: colors.paper, borderColor: colors.paperEdge }}
        >
          <span className="h-2.5 w-2.5" style={{ backgroundColor: colors.accent }} />
        </span>
      ) : (
        // Half light, half dark — the two states this option moves between.
        <span
          aria-hidden="true"
          className="border-rule h-7 w-7 flex-none border"
          style={{ background: 'linear-gradient(135deg, #F7F2E7 50%, #24211D 50%)' }}
        />
      )}

      <span className="min-w-0 flex-1 truncate">{label}</span>

      {selected && <Check size={14} className="text-accent flex-none" aria-hidden="true" />}
    </button>
  );
}
