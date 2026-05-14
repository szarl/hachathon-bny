"use client";

import { X } from "lucide-react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type PreviewMode = "source" | "rendered";

type HtmlPreviewModalProps = {
  open: boolean;
  url: string | null;
  onClose: () => void;
};

export function HtmlPreviewModal({
  open,
  url,
  onClose,
}: HtmlPreviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<PreviewMode>("rendered");
  const [htmlText, setHtmlText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lockScroll = open;
  useEffect(() => {
    if (!lockScroll) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockScroll]);

  useEffect(() => {
    if (!open) {
      return;
    }
    lastActiveRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    queueMicrotask(() => closeRef.current?.focus());
    return () => {
      lastActiveRef.current?.focus?.();
      lastActiveRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const stopDialogClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!open || !url) {
      return;
    }
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) {
        return;
      }
      setLoading(true);
      setHtmlText(null);
      setLoadError(null);
      try {
        const res = await fetch(url, { credentials: "omit", mode: "cors" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        if (!cancelled) {
          setHtmlText(text);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            "Could not load HTML as text (try Rendered if the preview URL still works).",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  if (!open || !url) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <div
        className="absolute inset-0"
        aria-hidden
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="html-preview-modal-title"
        className="relative z-10 flex max-h-[min(90vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-black/15 bg-white shadow-xl"
        onClick={stopDialogClick}
      >
        <header className="relative flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-3 pr-14">
          <h2 id="html-preview-modal-title" className="text-sm font-semibold text-black">
            HTML preview
          </h2>
          <div
            className="flex shrink-0 items-center gap-0.5 rounded-lg border border-black/10 bg-black/[0.03] p-0.5"
            role="group"
            aria-label="Preview display mode"
          >
            <button
              type="button"
              onClick={() => setMode("source")}
              aria-pressed={mode === "source"}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === "source"
                  ? "bg-white text-black shadow-sm"
                  : "text-black/60 hover:text-black"
              }`}
            >
              Source
            </button>
            <button
              type="button"
              onClick={() => setMode("rendered")}
              aria-pressed={mode === "rendered"}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === "rendered"
                  ? "bg-white text-black shadow-sm"
                  : "text-black/60 hover:text-black"
              }`}
            >
              Rendered
            </button>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg border border-transparent text-black/60 transition hover:bg-black/5 hover:text-black"
            aria-label="Close preview"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 bg-white">
          {loading ? (
            <div className="flex h-[min(75vh,720px)] items-center justify-center text-sm text-black/50">
              Loading preview…
            </div>
          ) : mode === "source" ? (
            <pre
              className="m-0 max-h-[min(75vh,720px)] overflow-auto bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100"
              tabIndex={0}
            >
              {htmlText ?? loadError ?? ""}
            </pre>
          ) : htmlText ? (
            <iframe
              title="HTML preview (rendered)"
              srcDoc={htmlText}
              className="h-[min(75vh,720px)] w-full border-0"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-same-origin"
            />
          ) : (
            <iframe
              title="HTML preview (rendered)"
              src={url}
              className="h-[min(75vh,720px)] w-full border-0"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}
