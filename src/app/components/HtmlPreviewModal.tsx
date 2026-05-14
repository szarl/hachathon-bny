"use client";

import { X } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useRef } from "react";

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
        <header className="relative flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-3 pr-14">
          <h2 id="html-preview-modal-title" className="text-sm font-semibold text-black">
            HTML preview
          </h2>
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
          <iframe
            title="HTML preview"
            src={url}
            className="h-[min(75vh,720px)] w-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
