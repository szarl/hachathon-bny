"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import type { ConversionState } from "@/app/hooks/useConversionStream";
import {
  PROGRESS_STEPS,
  stageToProgressMacroIndex,
} from "@/app/hooks/useConversionStream";

type ProgressIndicatorProps = {
  state: ConversionState;
};

export function ProgressIndicator({ state }: ProgressIndicatorProps) {
  const [issuesExpanded, setIssuesExpanded] = useState(true);

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
    (state.validationIssues.length > 0 || state.validationPassed === true);

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
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
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
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : isActive ? (
                  <span
                    className="mt-0.5 h-3 w-3 rounded-full bg-blue-600 dark:bg-blue-500"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="mt-0.5 h-3 w-3 rounded-full border-2 border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800"
                    aria-hidden
                  />
                )}
                {i < PROGRESS_STEPS.length - 1 ? (
                  <span
                    className="my-0.5 w-px grow min-h-[14px] bg-zinc-200 dark:bg-zinc-700"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <span
                  className={
                    isActive
                      ? "font-semibold text-zinc-900 dark:text-zinc-50"
                      : isComplete
                        ? "font-medium text-zinc-700 dark:text-zinc-300"
                        : "text-zinc-500 dark:text-zinc-500"
                  }
                >
                  {step.label}
                </span>
                {isActive && showSubStatus ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {state.stageLabel}
                  </p>
                ) : null}
                {i === PROGRESS_STEPS.length - 1 && doneSummary ? (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {doneSummary}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {showValidationBadge ? (
        <div className="mt-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {state.validationPassed === true ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              All checks passed
            </p>
          ) : state.validationIssues.length > 0 ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIssuesExpanded((v) => !v)}
                className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-sm font-medium text-amber-950 transition hover:bg-amber-100 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
              >
                {state.issuesFixed > 0
                  ? `Fixed ${state.issuesFixed} issue${state.issuesFixed === 1 ? "" : "s"}`
                  : `${state.validationIssues.length} issue${state.validationIssues.length === 1 ? "" : "s"} reported`}
                <span className="ml-2 text-xs font-normal opacity-80">
                  {issuesExpanded ? "Hide details" : "Show details"}
                </span>
              </button>
              {issuesExpanded ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/50">
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {state.validationIssues.map((issue, idx) => (
                      <div
                        key={`${issue.file ?? ""}-${issue.rule}-${idx}`}
                        className="grid gap-1 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.4fr)] sm:gap-3"
                      >
                        <code className="break-all text-xs text-zinc-800 dark:text-zinc-200">
                          {issue.file ?? "—"}
                        </code>
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {issue.rule}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
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
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
