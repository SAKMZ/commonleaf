'use client';

import { useState } from 'react';

import { Choice, Fieldset, Slider, Toggle } from '@/components/settings/controls';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { VaultTransfer } from '@/components/settings/VaultTransfer';
import { useSettings } from '@/hooks/useSettings';
import { formatDate } from '@/lib/notes/dates';
import { editorFonts, displayFonts, readingFonts } from '@/lib/theme/fonts';

/**
 * Every reader preference, in one place.
 *
 * Changes apply the moment they are made — there is no Save button, because
 * there is nothing to save: settings live in `localStorage` and on the document
 * element, never in the repository. Changing the line height should not produce
 * a commit.
 */

const DATE_PATTERNS = [
  'D MMMM YYYY',
  'MMMM D, YYYY',
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'ddd D MMM YYYY',
] as const;

const AUTOSAVE_DELAYS = [
  { id: '800', label: 'Almost at once' },
  { id: '2000', label: 'After a short pause' },
  { id: '5000', label: 'After a long pause' },
  { id: '30000', label: 'Rarely' },
] as const;

export function SettingsForm() {
  const { settings, update, reset } = useSettings();
  const [confirmingReset, setConfirmingReset] = useState(false);

  // A fixed date, so the examples do not shuffle as the day goes on.
  const sample = new Date(2026, 2, 9, 15, 4);

  return (
    <div className="space-y-9">
      <ThemePicker value={settings.theme} onChange={(theme) => update({ theme })} />

      <Fieldset legend="Type" description="How the text itself is set.">
        <Choice
          label="Reading"
          value={settings.readingFont}
          options={readingFonts}
          onChange={(readingFont) => update({ readingFont })}
        />
        <Choice
          label="Headings"
          value={settings.displayFont}
          options={displayFonts}
          onChange={(displayFont) => update({ displayFont })}
        />
        <Choice
          label="Editor"
          value={settings.editorFont}
          options={editorFonts}
          onChange={(editorFont) => update({ editorFont })}
        />

        <Slider
          label="Size"
          value={settings.fontSize}
          min={15}
          max={26}
          step={1}
          format={(value) => `${value}px`}
          onChange={(fontSize) => update({ fontSize })}
        />
        <Slider
          label="Line height"
          value={settings.lineHeight}
          min={1.3}
          max={2.2}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(lineHeight) => update({ lineHeight })}
        />
        <Slider
          label="Space between paragraphs"
          value={settings.paragraphSpacing}
          min={0}
          max={2}
          step={0.05}
          format={(value) => `${value.toFixed(2)}em`}
          onChange={(paragraphSpacing) => update({ paragraphSpacing })}
        />
        <Slider
          label="Column width"
          value={settings.readingWidth}
          min={560}
          max={960}
          step={10}
          format={(value) => `${value}px`}
          onChange={(readingWidth) => update({ readingWidth })}
        />
      </Fieldset>

      <Fieldset legend="Paper" description="The physical conceits, all optional.">
        <Slider
          label="Grain"
          value={settings.texture}
          min={0}
          max={100}
          step={5}
          format={(value) => (value === 0 ? 'none' : `${value}%`)}
          onChange={(texture) => update({ texture })}
        />
        <Toggle
          label="Deckled edges"
          hint="A torn edge down the outside of the sheet."
          checked={settings.deckledEdges}
          onChange={(deckledEdges) => update({ deckledEdges })}
        />
        <Toggle
          label="Stitched binding"
          hint="Thread down the inner margin."
          checked={settings.binding}
          onChange={(binding) => update({ binding })}
        />
        <Toggle
          label="Ribbon bookmark"
          checked={settings.ribbon}
          onChange={(ribbon) => update({ ribbon })}
        />
      </Fieldset>

      <Fieldset legend="Reading and writing">
        <Toggle
          label="Show the index"
          hint="The folders and tags beside the page, on a wide screen."
          checked={settings.sidebar}
          onChange={(sidebar) => update({ sidebar })}
        />
        <Toggle
          label="Formatting buttons"
          hint="Bold, headings, lists and the rest, above the editor. Turn off if you write Markdown by hand."
          checked={settings.editorToolbar}
          onChange={(editorToolbar) => update({ editorToolbar })}
        />
        <Choice
          label="Save while typing"
          value={String(settings.autosaveDelay)}
          options={AUTOSAVE_DELAYS}
          onChange={(value) => update({ autosaveDelay: Number(value) })}
        />
        <Choice
          label="Dates"
          value={settings.dateFormat}
          options={DATE_PATTERNS.map((pattern) => ({
            id: pattern,
            label: formatDate(sample, pattern),
          }))}
          onChange={(dateFormat) => update({ dateFormat })}
        />
      </Fieldset>

      <Fieldset legend="Access">
        <Toggle
          label="High contrast"
          hint="Deepens the ink and the rules without abandoning the paper."
          checked={settings.highContrast}
          onChange={(highContrast) => update({ highContrast })}
        />
        <Toggle
          label="Motion"
          hint="Turned off automatically if your system already asks for that."
          checked={settings.animations}
          onChange={(animations) => update({ animations })}
        />
      </Fieldset>

      <VaultTransfer />

      <div className="border-rule border-t pt-6">
        {confirmingReset ? (
          <p className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ink-muted">
              Put every setting back to its default? Your notes are not affected.
            </span>
            <button
              type="button"
              className="text-accent underline"
              onClick={() => {
                reset();
                setConfirmingReset(false);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="text-ink-faint underline"
              onClick={() => setConfirmingReset(false)}
            >
              Cancel
            </button>
          </p>
        ) : (
          <button
            type="button"
            className="text-ink-faint hover:text-accent text-sm underline"
            onClick={() => setConfirmingReset(true)}
          >
            Reset everything to defaults
          </button>
        )}
      </div>
    </div>
  );
}
