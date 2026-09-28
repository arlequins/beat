"use client";

export type ReaderPreferences = {
  size: number;
  line: number;
  theme: "paper" | "white" | "night";
  font: "serif" | "sans";
};

export type ReaderSettingsLabels = {
  background: string;
  font: string;
  size: string;
  line: string;
  reset: string;
  stored: string;
  white: string;
  paper: string;
  night: string;
  sans: string;
  serif: string;
};

export const defaultReaderPreferences: ReaderPreferences = {
  size: 18,
  line: 1.9,
  theme: "night",
  font: "sans",
};

export function ReaderSettingsPanel({
  preferences,
  labels,
  onChange,
}: {
  preferences: ReaderPreferences;
  labels: ReaderSettingsLabels;
  onChange: (next: Partial<ReaderPreferences>) => void;
}) {
  return (
    <div className="viewer-settings">
      <fieldset>
        <legend>{labels.background}</legend>
        <div>
          {(["white", "paper", "night"] as const).map((theme) => (
            <button
              type="button"
              key={theme}
              aria-pressed={preferences.theme === theme}
              onClick={() => onChange({ theme })}
            >
              {
                {
                  white: labels.white,
                  paper: labels.paper,
                  night: labels.night,
                }[theme]
              }
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{labels.font}</legend>
        <div>
          <button
            type="button"
            aria-pressed={preferences.font === "sans"}
            onClick={() => onChange({ font: "sans" })}
          >
            {labels.sans}
          </button>
          <button
            type="button"
            aria-pressed={preferences.font === "serif"}
            onClick={() => onChange({ font: "serif" })}
          >
            {labels.serif}
          </button>
        </div>
      </fieldset>
      <label>
        {labels.size} <output>{preferences.size}px</output>
        <input
          type="range"
          min="14"
          max="28"
          value={preferences.size}
          onChange={(event) => onChange({ size: Number(event.target.value) })}
        />
      </label>
      <label>
        {labels.line} <output>{preferences.line.toFixed(1)}</output>
        <input
          type="range"
          min="1.5"
          max="2.5"
          step="0.1"
          value={preferences.line}
          onChange={(event) => onChange({ line: Number(event.target.value) })}
        />
      </label>
      <button
        className="viewer-reset"
        type="button"
        onClick={() => onChange(defaultReaderPreferences)}
      >
        {labels.reset}
      </button>
      <p>{labels.stored}</p>
    </div>
  );
}
