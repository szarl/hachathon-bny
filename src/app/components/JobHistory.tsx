"use client";

import { useCallback, useEffect, useState } from "react";

import { HtmlPreviewModal } from "@/app/components/HtmlPreviewModal";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { formatTokenTotal } from "@/lib/token-usage";

/** Latest N jobs; matches architecture note (10 or 20). */
const JOB_HISTORY_LIMIT = 20;

/** Realtime plus 3s polling so rows stay fresh if websockets fail (PRD-13). */
const POLL_MS = 3000;

export type JobHistoryRow = {
  id: string;
  created_at: string;
  filename: string;
  status: string;
  output_url: string | null;
  /** Denormalized for reliable history previews (migration 002); optional until migration applied. */
  html_preview_url?: string | null;
  metadata: {
    htmlPreviewUrl?: string;
    tokenUsage?: {
      total?: number;
    };
  } | null;
};

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function sortByCreatedDesc(rows: JobHistoryRow[]): JobHistoryRow[] {
  return [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function sliceLimit(rows: JobHistoryRow[]): JobHistoryRow[] {
  return sortByCreatedDesc(rows).slice(0, JOB_HISTORY_LIMIT);
}

function badgeClasses(status: string): string {
  if (status === "done") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (status === "error") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (status === "generating") {
    return "border-bny-teal/40 bg-bny-teal/10 text-bny-navy";
  }
  return "border-black/15 bg-black/5 text-black/80";
}

function openDownload(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function getHtmlPreviewUrl(job: JobHistoryRow): string | null {
  const direct = job.html_preview_url;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  let m = job.metadata;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m) as JobHistoryRow["metadata"];
    } catch {
      return null;
    }
  }
  if (!m || typeof m !== "object") {
    return null;
  }
  const raw = "htmlPreviewUrl" in m ? (m as { htmlPreviewUrl?: unknown }).htmlPreviewUrl : undefined;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function parseMetadata(meta: JobHistoryRow["metadata"] | string): JobHistoryRow["metadata"] {
  if (typeof meta !== "string") {
    return meta;
  }
  try {
    return JSON.parse(meta) as JobHistoryRow["metadata"];
  } catch {
    return null;
  }
}

function getTokenUsageTotal(job: JobHistoryRow): number | null {
  const metadata = parseMetadata(job.metadata);
  const total = metadata?.tokenUsage?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

export function JobHistory() {
  const [jobs, setJobs] = useState<JobHistoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();

  const fetchJobs = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(JOB_HISTORY_LIMIT);

    if (error) {
      setLoadError(error.message);
      return;
    }

    setLoadError(null);
    setJobs(sliceLimit((data ?? []) as JobHistoryRow[]));
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    queueMicrotask(() => {
      void fetchJobs();
    });

    const channel = supabase
      .channel("job-history")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        (payload) => {
          if (payload.eventType === "DELETE" && payload.old && "id" in payload.old) {
            const id = String((payload.old as { id: string }).id);
            setJobs((prev) => prev.filter((j) => j.id !== id));
            return;
          }

          queueMicrotask(() => {
            void fetchJobs();
          });
        },
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void fetchJobs();
    }, POLL_MS);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [supabase, fetchJobs]);

  if (!supabase) {
    return (
      <section
        className="rounded-xl border border-black/15 bg-white p-5 shadow-sm"
        aria-label="Job history"
      >
        <h2 className="text-base font-semibold text-black">Recent jobs</h2>
        <p className="mt-2 text-sm text-black/70">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to load history.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-black/15 bg-white p-5 shadow-sm"
      aria-label="Job history"
    >
      <h2 className="mb-4 text-base font-semibold text-black">Recent jobs</h2>

      {loadError ? (
        <p className="mb-3 text-sm text-amber-900" role="status">
          {loadError}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/15">
              <th className="pb-2 pr-3 font-medium text-black/70">Filename</th>
              <th className="pb-2 pr-3 font-medium text-black/70">Created</th>
              <th className="pb-2 pr-3 font-medium text-black/70">Status</th>
              <th className="pb-2 pr-3 font-medium text-black/70">Tokens</th>
              <th className="pb-2 pr-3 font-medium text-black/70">Preview</th>
              <th className="pb-2 font-medium text-black/70">Download</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-black/60">
                  No jobs yet.
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const previewUrl = getHtmlPreviewUrl(job);
                const tokenTotal = getTokenUsageTotal(job);
                return (
                  <tr
                    key={job.id}
                    className="border-b border-black/10 last:border-0"
                  >
                    <td className="max-w-[200px] truncate py-2.5 pr-3 font-medium text-black">
                      {job.filename}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-black/70">
                      {DATE_FMT.format(new Date(job.created_at))}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${badgeClasses(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-black/70">
                      {tokenTotal != null ? formatTokenTotal(tokenTotal) : "-"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {job.status === "done" ? (
                        previewUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewModalUrl(previewUrl)}
                            className="text-sm font-semibold text-bny-teal underline-offset-2 hover:underline"
                            aria-label="Open HTML preview"
                          >
                            Preview HTML
                          </button>
                        ) : (
                          <span
                            className="text-black/40"
                            title="No HTML preview stored for this job (older run or preview was unavailable)."
                          >
                            —
                          </span>
                        )
                      ) : (
                        <span className="text-black/40">—</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {job.status === "done" && job.output_url ? (
                        <button
                          type="button"
                          onClick={() => openDownload(job.output_url!)}
                          className="text-sm font-semibold text-bny-teal underline-offset-2 hover:underline"
                        >
                          Download ZIP
                        </button>
                      ) : (
                        <span className="text-black/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <HtmlPreviewModal
        key={previewModalUrl ?? "html-preview-closed"}
        open={previewModalUrl != null}
        url={previewModalUrl}
        onClose={() => setPreviewModalUrl(null)}
      />
    </section>
  );
}
