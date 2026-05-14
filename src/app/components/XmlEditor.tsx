"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import type { ConversionState } from "@/app/hooks/useConversionStream";
import { parseDelimitedDitaOutput } from "@/lib/parse-delimited-dita-output";

function pickXmlTextFiles(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).filter(
      ([name]) => name.endsWith(".dita") || name.endsWith(".ditamap"),
    ),
  );
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(50vh,420px)] items-center justify-center rounded-lg border border-black/15 bg-black/[0.04] text-sm text-black/60">
      Loading editor…
    </div>
  ),
});

/** Tab order: c_*.dita, t_*.dita, r_*.dita, other .dita, *.ditamap (last). */
function tabOrderRank(name: string): [number, string] {
  if (name.endsWith(".ditamap")) {
    return [4, name];
  }
  if (name.startsWith("c_") && name.endsWith(".dita")) {
    return [0, name];
  }
  if (name.startsWith("t_") && name.endsWith(".dita")) {
    return [1, name];
  }
  if (name.startsWith("r_") && name.endsWith(".dita")) {
    return [2, name];
  }
  if (name.endsWith(".dita")) {
    return [3, name];
  }
  return [3, name];
}

function sortTabKeys(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const [ra, ka] = tabOrderRank(a);
    const [rb, kb] = tabOrderRank(b);
    if (ra !== rb) {
      return ra - rb;
    }
    return ka.localeCompare(kb);
  });
}

export type XmlEditorProps = {
  state: ConversionState;
};

export function XmlEditor({ state }: XmlEditorProps) {
  const { displayFiles, hasValidated } = useMemo(() => {
    const validated = pickXmlTextFiles(state.files);
    const has = Object.keys(validated).length > 0;
    const files = has
      ? validated
      : pickXmlTextFiles(parseDelimitedDitaOutput(state.xmlBuffer));
    return { displayFiles: files, hasValidated: has };
  }, [state.files, state.xmlBuffer]);

  const hasFileTabs = Object.keys(displayFiles).length > 0;

  const sortedKeys = useMemo(
    () => sortTabKeys(Object.keys(displayFiles)),
    [displayFiles],
  );

  const defaultTab = useMemo(
    () => sortedKeys.find((k) => k.endsWith(".ditamap")) ?? sortedKeys[0] ?? null,
    [sortedKeys],
  );

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  /** In-browser edits after `done`; not persisted to Supabase or the ZIP. */
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.stage !== "done") {
      queueMicrotask(() => {
        setEditedContent({});
      });
    }
  }, [state.stage]);

  const displaySelected =
    sortedKeys.length > 0
      ? selectedFile && sortedKeys.includes(selectedFile)
        ? selectedFile
        : defaultTab
      : null;

  const canEdit = state.stage === "done" && hasFileTabs;

  const value =
    hasFileTabs && displaySelected != null
      ? (editedContent[displaySelected] ?? displayFiles[displaySelected] ?? "")
      : state.xmlBuffer;

  const statusLabel = hasValidated
    ? "Validated output"
    : hasFileTabs
      ? "Live preview"
      : null;

  return (
    <section className="flex flex-col gap-2" aria-label="DITA XML preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-black">
          XML Preview
        </h2>
        <div className="flex flex-col items-end gap-0.5 text-right">
          {statusLabel ? (
            <span className="text-xs text-black/60">{statusLabel}</span>
          ) : null}
          {canEdit ? (
            <span className="max-w-[18rem] text-[11px] leading-snug text-black/50">
              Edits stay in this session only; download the ZIP for the server output.
            </span>
          ) : null}
        </div>
      </div>

      {hasFileTabs ? (
        <div
          className="flex flex-wrap gap-1 border-b border-black/15 pb-2"
          role="tablist"
          aria-label="Output files"
        >
          {sortedKeys.map((name) => {
            const isActive = name === displaySelected;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedFile(name)}
                className={
                  isActive
                    ? "rounded-md bg-bny-teal/15 px-2.5 py-1 text-xs font-medium text-bny-navy"
                    : "rounded-md px-2.5 py-1 text-xs font-medium text-black/70 transition hover:bg-black/5"
                }
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-black/15">
        <MonacoEditor
          height="min(50vh, 420px)"
          language="xml"
          theme="vs-dark"
          value={value}
          onChange={
            canEdit && displaySelected
              ? (v) => {
                  setEditedContent((prev) => ({
                    ...prev,
                    [displaySelected]: v ?? "",
                  }));
                }
              : undefined
          }
          options={{
            readOnly: !canEdit,
            minimap: { enabled: false },
            fontSize: 13,
          }}
        />
      </div>
    </section>
  );
}
