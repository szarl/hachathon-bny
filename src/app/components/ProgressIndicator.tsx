"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import type { ConversionState } from "@/app/hooks/useConversionStream";
import {
  PROGRESS_STEPS,
  stageToProgressMacroIndex,
} from "@/app/hooks/useConversionStream";

const BUSY_PHRASES = ["Thinking", "Processing", "Working", "Extracting"] as const;

type ProgressIndicatorProps = {
  state: ConversionState;
};

export function ProgressIndicator({ state }: ProgressIndicatorProps) {
  const [issuesExpanded, setIssuesExpanded] = useState(true);
  const [busyPhraseIndex, setBusyPhraseIndex] = useState(0);
  const [busyDotIndex, setBusyDotIndex] = useState(0);

  const showAnimatedBusy =
    state.stage !== "idle" &&
    state.stage !== "done" &&
    state.stage !== "error";

  useEffect(() => {
    if (!showAnimatedBusy) {
      return;
    }
    const dotsId = window.setInterval(() => {
      setBusyDotIndex((i) => (i + 1) % 3);
    }, 1400);
    const phraseId = window.setInterval(() => {
      setBusyPhraseIndex((i) => (i + 1) % BUSY_PHRASES.length);
    }, 2500);
    return () => {
      window.clearInterval(dotsId);
      window.clearInterval(phraseId);
    };
  }, [showAnimatedBusy]);

  const macroRunning = stageToProgressMacroIndex(state.stage);
  const activeMacroIndex =
    state.stage === "idle"
      ? -1
      : state.stage === "done"
        ? -1
        : state.stage === "error"
          ? (state.failedAtMacroIndex ?? -1)
          : macroRunning;

  const atOrPastValidation =
    stageToProgressMacroIndex(state.stage) >= 3 ||
    state.stage === "validating" ||
    state.stage === "saving" ||
    state.stage === "done";

  const showValidationBadge =
    atOrPastValidation &&
    (state.validationIssues.length > 0 ||
      state.validationPassed === true ||
      state.validationAgent2Skipped);

  const xmlCount =
    state.metadata?.fileCount ?? Object.keys(state.files).length;
  const imageCount =
    state.metadata?.usedAssetCount ??
    state.assets.filter((a) => a.status === "used").length;

  const doneSummary =
    state.stage === "done" && xmlCount >= 0
      ? `${xmlCount} XML file${xmlCount === 1 ? "" : "s"} · ${imageCount} image${imageCount === 1 ? "" : "s"} · ZIP ready`
      : null;

  const showSubStatus =
    state.stage !== "idle" &&
    state.stage !== "error" &&
    state.stage !== "done" &&
    state.stageLabel.trim().length > 0;

  return (
    <section
      className="rounded-xl border border-black/15 bg-white p-5 shadow-sm"
      aria-label="Conversion progress"
    >
      <ol className="flex flex-col gap-0">
        {PROGRESS_STEPS.map((step, i) => {
          const isComplete =
            state.stage === "done" ||
            (activeMacroIndex >= 0 && i < activeMacroIndex);
          const isActive =
            state.stage !== "idle" &&
            state.stage !== "done" &&
            activeMacroIndex === i;

          return (
            <li key={step.label} className="flex gap-3">
              <div className="flex w-6 flex-col items-center pt-0.5">
                {isComplete ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : isActive ? (
                  <span
                    className="mt-0.5 h-3 w-3 rounded-full bg-bny-teal"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="mt-0.5 h-3 w-3 rounded-full border-2 border-black/20 bg-black/5"
                    aria-hidden
                  />
                )}
                {i < PROGRESS_STEPS.length - 1 ? (
                  <span
                    className="my-0.5 w-px grow min-h-[14px] bg-black/15"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <span
                  className={
                    isActive
                      ? "font-semibold text-black"
                      : isComplete
                        ? "font-medium text-black/80"
                        : "text-black/50"
                  }
                >
                  {step.label}
                </span>
                {isActive && showSubStatus ? (
                  <p className="mt-1 text-sm text-black/70">
                    {state.stageLabel}
                  </p>
                ) : null}
                {i === PROGRESS_STEPS.length - 1 && doneSummary ? (
                  <p className="mt-1 text-sm text-black/60">
                    {doneSummary}
                  </p>
                ) : null}
                {isActive && showAnimatedBusy ? (
                  <p
                    className="mt-2 text-sm text-black/60"
                    role="status"
                    aria-live="polite"
                    aria-label="Background activity"
                  >
                    {BUSY_PHRASES[busyPhraseIndex % BUSY_PHRASES.length]}
                    <span className="inline-block min-w-[1.25em] tabular-nums">
                      {busyDotIndex === 0
                        ? "."
                        : busyDotIndex === 1
                          ? ".."
                          : "..."}
                    </span>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {showValidationBadge ? (
        <div className="mt-2 border-t border-black/15 pt-4">
          {state.validationAgent2Skipped ? (
            <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
              <span className="font-medium">Agent 2 skipped.</span> LLM validation is off on the
              server (<code className="rounded bg-black/5 px-1 text-xs">GEMINI_AGENT2_ENABLED=false</code>
              ). The ZIP is Agent&nbsp;1 output only; findings below are from basic checks, not a full
              model review.
            </p>
          ) : null}
          {state.validationPassed === true && !state.validationAgent2Skipped ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
              All checks passed
            </p>
          ) : state.validationPassed === true && state.validationAgent2Skipped ? (
            state.validationIssues.length === 0 ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                Basic checks: no blocking errors
              </p>
            ) : null
          ) : state.validationIssues.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIssuesExpanded((v) => !v)}
                  className="w-full flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-sm font-medium text-amber-950 transition hover:bg-amber-100 sm:min-w-0"
                >
                  {state.issuesFixed > 0
                    ? `Fixed ${state.issuesFixed} issue${state.issuesFixed === 1 ? "" : "s"}`
                    : `${state.validationIssues.length} issue${state.validationIssues.length === 1 ? "" : "s"} reported`}
                  <span className="ml-2 text-xs font-normal opacity-80">
                    {issuesExpanded ? "Hide details" : "Show details"}
                  </span>
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-bny-teal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 sm:self-start"
                >
                  Fix issues
                </button>
              </div>
              {issuesExpanded ? (
                <div className="min-w-0 overflow-x-auto rounded-lg border border-black/15 bg-black/[0.03]">
                  <div className="divide-y divide-black/10">
                    {state.validationIssues.map((issue, idx) => (
                      <div
                        key={`${issue.file ?? ""}-${issue.rule}-${idx}`}
                        className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,26%)_minmax(0,22%)_minmax(0,1fr)] sm:items-start sm:gap-y-2"
                      >
                        <code className="max-w-full min-w-0 break-all text-xs text-black">
                          {issue.file ?? "—"}
                        </code>
                        <span className="max-w-full min-w-0 break-words font-medium text-black/80">
                          {issue.rule}
                        </span>
                        <span className="max-w-full min-w-0 break-words [overflow-wrap:anywhere] text-black/70">
                          {issue.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {state.stage === "error" && state.error ? (
        <p
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
