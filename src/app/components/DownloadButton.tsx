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
      className="rounded-xl border border-black/15 bg-white p-5 shadow-sm"
      aria-label="Download output"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-black/70">
            {xmlCount} XML file{xmlCount === 1 ? "" : "s"} · {imageCount} image
            {imageCount === 1 ? "" : "s"} · ZIP ready
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg bg-bny-teal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
        >
          Download DITA ZIP
        </button>
      </div>
    </section>
  );
}
