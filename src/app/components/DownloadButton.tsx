"use client";

import type { ConversionState } from "@/app/hooks/useConversionStream";

type DownloadButtonProps = {
  state: ConversionState;
};

export function DownloadButton({ state }: DownloadButtonProps) {
  if (state.stage !== "done" || !state.outputUrl) {
    return null;
  }

  const xmlCount = state.metadata?.fileCount ?? 0;
  const imageCount = state.metadata?.usedAssetCount ?? 0;

  const handleDownload = () => {
    window.open(state.outputUrl!, "_blank", "noopener,noreferrer");
  };

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Download output"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {xmlCount} XML file{xmlCount === 1 ? "" : "s"} · {imageCount} image
            {imageCount === 1 ? "" : "s"} · ZIP ready
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Download DITA ZIP
        </button>
      </div>
    </section>
  );
}
