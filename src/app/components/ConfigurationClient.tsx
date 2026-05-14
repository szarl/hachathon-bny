"use client";

import { useCallback, useState } from "react";

const GEMINI_OUT_MIN = 4096;
const GEMINI_OUT_CAP = 131_072;

const DEFAULTS = {
  agent1Temperature: 0.1,
  agent1TopP: 0.95,
  agent1MaxOutputTokens: 65_536,
  agent2Temperature: 0,
  agent2TopP: 1,
  classifyTemperature: 0,
  showAdvanced: false,
  compactLayout: false,
} as const;

type SettingsState = {
  agent1Temperature: number;
  agent1TopP: number;
  agent1MaxOutputTokens: number;
  agent2Temperature: number;
  agent2TopP: number;
  classifyTemperature: number;
  showAdvanced: boolean;
  compactLayout: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function LabeledSlider({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  displayValue,
}: {
  id: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  displayValue: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-black">
          {label}
        </label>
        <span className="tabular-nums text-sm text-black/70">{displayValue}</span>
      </div>
      {hint ? <p className="text-xs text-black/55">{hint}</p> : null}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        className="w-full accent-bny-teal"
      />
    </div>
  );
}

function SectionCard({
  title,
  description,
  compact,
  children,
}: {
  title: string;
  description?: string;
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-black/15 bg-white ${compact ? "p-4" : "p-5 sm:p-6"}`}
    >
      <h2 className={`font-semibold text-black ${compact ? "text-base" : "text-lg"}`}>{title}</h2>
      {description ? (
        <p className={`mt-1 text-black/65 ${compact ? "text-xs" : "text-sm"}`}>{description}</p>
      ) : null}
      <div className={compact ? "mt-4 space-y-4" : "mt-5 space-y-5"}>{children}</div>
    </section>
  );
}

export function ConfigurationClient() {
  const [s, setS] = useState<SettingsState>({ ...DEFAULTS });

  const reset = useCallback(() => {
    setS({ ...DEFAULTS });
  }, []);

  const gap = s.compactLayout ? "gap-4" : "gap-6";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-black">Configuration</h1>
      <p className="mt-2 max-w-3xl text-sm text-black/70">
        Tune model and UI options for exploration. These values are not saved and are not applied to
        the live conversion pipeline; the server uses its own fixed parameters.
      </p>

      <div className={`mt-8 flex flex-col ${gap}`}>
        <SectionCard
          title="Page layout"
          description="Affects this screen only."
          compact={s.compactLayout}
        >
          <label className="flex cursor-pointer items-center gap-3 text-sm text-black">
            <input
              type="checkbox"
              checked={s.showAdvanced}
              onChange={(e) => setS((p) => ({ ...p, showAdvanced: e.target.checked }))}
              className="size-4 rounded border-black/30 text-bny-teal focus:ring-bny-teal"
            />
            Show advanced options (max output tokens)
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-black">
            <input
              type="checkbox"
              checked={s.compactLayout}
              onChange={(e) => setS((p) => ({ ...p, compactLayout: e.target.checked }))}
              className="size-4 rounded border-black/30 text-bny-teal focus:ring-bny-teal"
            />
            Compact layout
          </label>
        </SectionCard>

        <SectionCard
          title="Classification"
          description="Topic classification from extracted PDF text."
          compact={s.compactLayout}
        >
          <LabeledSlider
            id="classify-temp"
            label="Temperature"
            hint="Lower values favor deterministic topic labels."
            min={0}
            max={2}
            step={0.05}
            value={s.classifyTemperature}
            onChange={(v) => setS((p) => ({ ...p, classifyTemperature: clamp(v, 0, 2) }))}
            displayValue={s.classifyTemperature.toFixed(2)}
          />
        </SectionCard>

        <SectionCard
          title="Generation (Agent 1)"
          description="DITA XML generation from classified topics."
          compact={s.compactLayout}
        >
          <LabeledSlider
            id="a1-temp"
            label="Temperature"
            hint="Higher values increase variety; lower values are closer to greedy decoding."
            min={0}
            max={2}
            step={0.05}
            value={s.agent1Temperature}
            onChange={(v) => setS((p) => ({ ...p, agent1Temperature: clamp(v, 0, 2) }))}
            displayValue={s.agent1Temperature.toFixed(2)}
          />
          <LabeledSlider
            id="a1-topp"
            label="Top P"
            min={0}
            max={1}
            step={0.01}
            value={s.agent1TopP}
            onChange={(v) => setS((p) => ({ ...p, agent1TopP: clamp(v, 0, 1) }))}
            displayValue={s.agent1TopP.toFixed(2)}
          />
          {s.showAdvanced ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="a1-max" className="text-sm font-medium text-black">
                  Max output tokens
                </label>
                <span className="tabular-nums text-sm text-black/70">{s.agent1MaxOutputTokens}</span>
              </div>
              <p className="text-xs text-black/55">
                Allowed range {GEMINI_OUT_MIN.toLocaleString()}–{GEMINI_OUT_CAP.toLocaleString()} (Gemini
                agent ceiling).
              </p>
              <input
                id="a1-max"
                type="range"
                min={GEMINI_OUT_MIN}
                max={GEMINI_OUT_CAP}
                step={1024}
                value={s.agent1MaxOutputTokens}
                onChange={(e) =>
                  setS((p) => ({
                    ...p,
                    agent1MaxOutputTokens: clamp(
                      Number.parseInt(e.target.value, 10),
                      GEMINI_OUT_MIN,
                      GEMINI_OUT_CAP,
                    ),
                  }))
                }
                className="w-full accent-bny-teal"
              />
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Validation (Agent 2)"
          description="Structured validation of generated DITA."
          compact={s.compactLayout}
        >
          <LabeledSlider
            id="a2-temp"
            label="Temperature"
            hint="Validation is usually run at zero temperature for stable JSON."
            min={0}
            max={2}
            step={0.05}
            value={s.agent2Temperature}
            onChange={(v) => setS((p) => ({ ...p, agent2Temperature: clamp(v, 0, 2) }))}
            displayValue={s.agent2Temperature.toFixed(2)}
          />
          <LabeledSlider
            id="a2-topp"
            label="Top P"
            min={0}
            max={1}
            step={0.01}
            value={s.agent2TopP}
            onChange={(v) => setS((p) => ({ ...p, agent2TopP: clamp(v, 0, 1) }))}
            displayValue={s.agent2TopP.toFixed(2)}
          />
        </SectionCard>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-black/20 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition-colors hover:bg-black/[0.03] focus:outline-none focus:ring-2 focus:ring-bny-teal focus:ring-offset-2"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
