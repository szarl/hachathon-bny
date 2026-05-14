"use client";

import { useCallback, useId, useRef, useState } from "react";

import type { ConversionState } from "@/app/hooks/useConversionStream";

import { validatePdfUpload } from "@/lib/jobs";

export function documentTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "");
  return (
    base
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() ||
    filename.replace(/\.pdf$/i, "") ||
    "Document"
  );
}

export type UploadZoneProps = {
  startConversion: (args: {
    jobId: string;
    documentTitle?: string;
  }) => Promise<void>;
  conversionState: ConversionState;
  className?: string;
};

type JobsApiOk = {
  jobId: string;
  pdfUrl?: string;
};

export function UploadZone({
  startConversion,
  conversionState,
  className,
}: UploadZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const pipelineRunning =
    conversionState.stage !== "idle" &&
    conversionState.stage !== "done" &&
    conversionState.stage !== "error";

  const blockingActions =
    isUploading || pipelineRunning;

  const convertDisabled =
    !file ||
    blockingActions;

  const pickPdfFromList = useCallback((incoming: Iterable<File>): File | null => {
    for (const f of incoming) {
      const name = f.name.toLowerCase();
      if (name.endsWith(".pdf")) {
        return f;
      }
    }
    return null;
  }, []);

  const applyFile = useCallback(
    (next: File | null) => {
      setLocalError(null);
      if (!next) {
        setFile(null);
        return;
      }
      const err = validatePdfUpload(next);
      if (err) {
        setLocalError(err);
        setFile(null);
        return;
      }
      setFile(next);
    },
    [],
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      const picked = list?.length ? pickPdfFromList(list) : null;
      if (list?.length && !picked) {
        setLocalError("Only PDF files are supported.");
        setFile(null);
      } else {
        applyFile(picked);
      }
      e.target.value = "";
    },
    [applyFile, pickPdfFromList],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer.files;
      const picked = dt.length ? pickPdfFromList(dt) : null;
      if (!dt.length) {
        setLocalError("Drop a PDF file.");
        return;
      }
      if (!picked) {
        setLocalError("Only PDF files are supported.");
        setFile(null);
        return;
      }
      applyFile(picked);
    },
    [applyFile, pickPdfFromList],
  );

  const handleConvert = useCallback(async () => {
    if (!file || blockingActions) {
      return;
    }
    setLocalError(null);
    const preCheck = validatePdfUpload(file);
    if (preCheck) {
      setLocalError(preCheck);
      return;
    }

    setIsUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/jobs", {
        method: "POST",
        body,
      });

      const text = await res.text();

      let jobId: string | undefined;

      try {
        const parsed = JSON.parse(text) as unknown;
        const record = parsed as JobsApiOk & { error?: string };
        if (typeof record.error === "string" && !res.ok) {
          setLocalError(record.error);
          return;
        }
        if (
          parsed &&
          typeof parsed === "object" &&
          "jobId" in parsed &&
          typeof (parsed as JobsApiOk).jobId === "string"
        ) {
          jobId = (parsed as JobsApiOk).jobId;
        }
      } catch {
        setLocalError(
          res.ok
            ? "Job server returned an unreadable response."
            : text.trim().slice(0, 280) ||
                `Upload failed (${res.status}).`,
        );
        return;
      }

      if (!res.ok || !jobId) {
        setLocalError(text.trim().slice(0, 280) || `Upload failed (${res.status}).`);
        return;
      }

      void startConversion({
        jobId,
        documentTitle: documentTitleFromFilename(file.name),
      }).catch(() => {
        /* errors are surfaced via conversionState.error */
      });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Could not upload the PDF.",
      );
    } finally {
      setIsUploading(false);
    }
  }, [file, blockingActions, startConversion]);

  const buttonLabel = (() => {
    if (isUploading) {
      return "Uploading…";
    }
    if (conversionState.stage === "connecting") {
      return conversionState.stageLabel || "Starting conversion…";
    }
    if (pipelineRunning && conversionState.stageLabel) {
      return conversionState.stageLabel;
    }
    if (pipelineRunning) {
      return "Working…";
    }
    return "Convert to DITA";
  })();

  return (
    <div className={className}>
      <div
        aria-labelledby={`${inputId}-label`}
        className={[
          "flex cursor-pointer flex-col gap-4 rounded-xl border border-dashed border-zinc-300 bg-white p-6 transition-colors hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-zinc-500",
        ].join(" ")}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) {
            return;
          }
          openFilePicker();
        }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDrop={handleDrop}
        role="presentation"
      >
        <label className="sr-only" htmlFor={`${inputId}-input`} id={`${inputId}-label`}>
          PDF file upload
        </label>
        <input
          id={`${inputId}-input`}
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={handleInputChange}
        />

        <p className="text-center text-base text-zinc-700 dark:text-zinc-300">
          Drop a PDF here or click to choose a file (.pdf only, 50&nbsp;MB max)
        </p>

        <div className="text-center">
          <button
            type="button"
            className={[
              "rounded-lg px-6 py-2.5 font-medium shadow-sm outline-none ring-offset-white transition focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-45 dark:ring-offset-zinc-950",
              pipelineRunning || isUploading || !file
                ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                : "bg-blue-900 text-white hover:bg-blue-800 dark:bg-blue-950 dark:hover:bg-blue-900",
            ].join(" ")}
            disabled={convertDisabled}
            onClick={(e) => {
              e.stopPropagation();
              void handleConvert();
            }}
          >
            {buttonLabel}
          </button>
        </div>

        {file ? (
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Selected:{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {file.name}
            </span>
            {" · "}
            {formatBytes(file.size)}
          </p>
        ) : null}

        {localError ? (
          <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
            {localError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
