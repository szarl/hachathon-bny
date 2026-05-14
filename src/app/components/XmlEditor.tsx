"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import type { ConversionState } from "@/app/hooks/useConversionStream";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(50vh,420px)] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
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
  const hasFiles = Object.keys(state.files).length > 0;

  const sortedKeys = useMemo(
    () => sortTabKeys(Object.keys(state.files)),
    [state.files],
  );

  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const displaySelected =
    hasFiles && sortedKeys.length > 0
      ? selectedFile && sortedKeys.includes(selectedFile)
        ? selectedFile
        : sortedKeys[0]
      : null;

  const value =
    hasFiles && displaySelected != null
      ? (state.files[displaySelected] ?? "")
      : state.xmlBuffer;

  return (
    <section className="flex flex-col gap-2" aria-label="DITA XML output">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          XML output
        </h2>
        {hasFiles ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Validated output
          </span>
        ) : null}
      </div>

      {hasFiles ? (
        <div
          className="flex flex-wrap gap-1 border-b border-zinc-200 pb-2 dark:border-zinc-700"
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
                    ? "rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900 dark:bg-blue-950/80 dark:text-blue-100"
                    : "rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <MonacoEditor
          height="min(50vh, 420px)"
          language="xml"
          theme="vs-dark"
          value={value}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
          }}
        />
      </div>
    </section>
  );
}
