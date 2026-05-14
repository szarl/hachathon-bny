"use client";

import { useEffect, useState } from "react";

import { HtmlPreviewModal } from "@/app/components/HtmlPreviewModal";
import type { ConversionState } from "@/app/hooks/useConversionStream";

type DownloadButtonProps = {
  state: ConversionState;
};

export function DownloadButton({ state }: DownloadButtonProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (state.stage !== "done" || !state.outputUrl) {
      queueMicrotask(() => {
        setPreviewOpen(false);
      });
    }
  }, [state.stage, state.outputUrl]);

  if (state.stage !== "done" || !state.outputUrl) {
    return null;
  }

  const xmlCount = state.metadata?.fileCount ?? 0;
  const imageCount = state.metadata?.usedAssetCount ?? 0;

  const previewUrl = state.metadata?.htmlPreviewUrl;
  const htmlStatus = state.metadata?.htmlGenerationStatus;
  const htmlMessage = state.metadata?.htmlGenerationMessage;

  const handleDownload = () => {
    window.open(state.outputUrl!, "_blank", "noopener,noreferrer");
  };

  const previewSource = state.metadata?.htmlPreviewSource;

  const handlePreviewHtml = () => {
    if (!previewUrl) {
      return;
    }
    setPreviewOpen(true);
  };

  const closePreview = () => setPreviewOpen(false);

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
            {previewUrl
              ? previewSource === "ai"
                ? " · AI HTML preview available (figures omitted)"
                : " · HTML preview available"
              : null}
          </p>
          {!previewUrl && htmlStatus && htmlStatus !== "ok" && htmlMessage ? (
            <p
              className="mt-2 max-w-xl text-xs leading-snug text-amber-900/90"
              role="status"
            >
              <span className="font-semibold">
                HTML preview unavailable
                {htmlStatus === "failed" ? " (DITA-OT failed)" : " (skipped)"}:
              </span>{" "}
              <span className="text-black/75">{htmlMessage}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {previewUrl ? (
            <button
              type="button"
              onClick={handlePreviewHtml}
              className="rounded-lg border border-bny-teal/40 bg-white px-4 py-2.5 text-sm font-semibold text-bny-teal shadow-sm transition hover:bg-bny-teal/10"
              aria-label="Open HTML preview in a modal"
            >
              Preview HTML
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-lg bg-bny-teal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
          >
            Download DITA ZIP
          </button>
        </div>
      </div>

      <HtmlPreviewModal
        open={previewOpen}
        url={previewUrl ?? null}
        onClose={closePreview}
      />
    </section>
  );
}
