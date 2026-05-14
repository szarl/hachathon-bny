"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import { HtmlPreviewModal } from "@/app/components/HtmlPreviewModal";
import { mapPool } from "@/lib/batch-concurrency";
import { BATCH_RUN_CONCURRENCY, BATCH_UPLOAD_CONCURRENCY, MAX_BATCH_JOBS } from "@/lib/batch-config";
import { getErrorMessage } from "@/lib/error-message";
import { validatePdfUpload } from "@/lib/jobs";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const POLL_MS = 3000;
const BATCH_HISTORY_LIMIT = 25;

type BatchJobRow = {
  id: string;
  created_at: string;
  filename: string;
  status: string;
  output_url: string | null;
  error: string | null;
  batch_id?: string | null;
  html_preview_url?: string | null;
  metadata: unknown;
};

type BatchHeader = {
  id: string;
  created_at: string;
};

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function parseMetadata(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object") {
    return null;
  }
  if (typeof meta === "string") {
    try {
      const parsed = JSON.parse(meta) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return meta as Record<string, unknown>;
}

function rowBelongsToBatch(row: BatchJobRow, batchId: string): boolean {
  if (row.batch_id && row.batch_id === batchId) {
    return true;
  }
  const m = parseMetadata(row.metadata);
  return typeof m?.batch_id === "string" && m.batch_id === batchId;
}

function getHtmlPreviewUrl(job: BatchJobRow): string | null {
  const direct = job.html_preview_url;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  const m = parseMetadata(job.metadata);
  if (!m) {
    return null;
  }
  const raw = m.htmlPreviewUrl;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function badgeClasses(status: string): string {
  if (status === "done") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (status === "error") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-bny-teal/40 bg-bny-teal/10 text-bny-navy";
}

async function createEmptyBatch(): Promise<string> {
  const res = await fetch("/api/batches", { method: "POST" });
  const text = await res.text();
  let parsed: { batchId?: string; error?: unknown } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(text.trim().slice(0, 280) || `Could not create batch (${res.status}).`);
  }
  if (!res.ok) {
    throw new Error(getErrorMessage(parsed.error ?? text));
  }
  const id = parsed.batchId?.trim();
  if (!id) {
    throw new Error("Server did not return a batch id.");
  }
  return id;
}

async function uploadOnePdf(file: File, batchId: string): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("batch_id", batchId);

  const res = await fetch("/api/jobs", {
    method: "POST",
    body,
  });

  const text = await res.text();
  let jobId: string | undefined;

  try {
    const parsed = JSON.parse(text) as { jobId?: string; error?: unknown };
    if (!res.ok && parsed?.error !== undefined) {
      throw new Error(getErrorMessage(parsed.error));
    }
    if (typeof parsed?.jobId === "string") {
      jobId = parsed.jobId;
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(text.trim().slice(0, 280) || `Upload failed (${res.status}).`);
    }
    throw e;
  }

  if (!res.ok || !jobId) {
    throw new Error(text.trim().slice(0, 280) || `Upload failed (${res.status}).`);
  }

  return jobId;
}

async function runSingleBatchJob(jobId: string): Promise<{ jobId: string; ok: boolean; error?: string }> {
  const runRes = await fetch("/api/batch/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobIds: [jobId] }),
  });

  const runText = await runRes.text();
  let parsed: { results?: Array<{ jobId: string; ok: boolean; error?: string }>; error?: unknown } = {};

  try {
    parsed = JSON.parse(runText) as typeof parsed;
  } catch {
    return { jobId, ok: false, error: runText.trim().slice(0, 200) || `Batch failed (${runRes.status}).` };
  }

  if (!runRes.ok) {
    return { jobId, ok: false, error: getErrorMessage(parsed.error ?? runText) };
  }

  const first = parsed.results?.[0];
  if (!first) {
    return { jobId, ok: false, error: "No result from server." };
  }
  return first;
}

function JobsTable({
  rows,
  emptyLabel,
  onPreview,
}: {
  rows: BatchJobRow[];
  emptyLabel: string;
  onPreview: (url: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-black/10 bg-black/[0.02] text-black/70">
          <tr>
            <th className="px-4 py-2 font-medium">Filename</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Preview</th>
            <th className="px-4 py-2 font-medium">Download</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-black/55">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const previewUrl = getHtmlPreviewUrl(row);
              return (
                <tr key={row.id} className="border-b border-black/5">
                  <td className="max-w-[220px] truncate px-4 py-2 font-medium text-black">{row.filename}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClasses(row.status)}`}
                    >
                      {row.status}
                    </span>
                    {row.status === "error" && row.error ? (
                      <span className="mt-1 block text-xs text-red-700">{row.error}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    {row.status === "done" ? (
                      previewUrl ? (
                        <button
                          type="button"
                          onClick={() => onPreview(previewUrl)}
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
                  <td className="px-4 py-2">
                    {row.output_url ? (
                      <a
                        href={row.output_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bny-teal underline hover:no-underline"
                      >
                        ZIP
                      </a>
                    ) : (
                      <span className="text-black/45">—</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function BatchJobsClient() {
  const inputId = useId();

  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<BatchJobRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const [batchHistory, setBatchHistory] = useState<BatchHeader[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<BatchJobRow[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const supabase = getSupabaseBrowser();

  const fetchBatchRows = useCallback(async () => {
    if (!supabase || !activeBatchId) {
      return;
    }

    const { data, error: qErr } = await supabase
      .from("jobs")
      .select("id,created_at,filename,status,output_url,error,batch_id,html_preview_url,metadata")
      .order("created_at", { ascending: false })
      .limit(120);

    if (qErr) {
      setError(qErr.message);
      return;
    }

    setError(null);
    const filtered = ((data ?? []) as BatchJobRow[]).filter((r) => rowBelongsToBatch(r, activeBatchId));
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRows(filtered);
  }, [supabase, activeBatchId]);

  const fetchBatchHistory = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { data, error: qErr } = await supabase
      .from("batches")
      .select("id,created_at")
      .order("created_at", { ascending: false })
      .limit(BATCH_HISTORY_LIMIT);

    if (qErr) {
      return;
    }

    setBatchHistory((data ?? []) as BatchHeader[]);
  }, [supabase]);

  const fetchExpandedJobs = useCallback(
    async (batchId: string) => {
      if (!supabase) {
        return;
      }
      setExpandedLoading(true);
      const orFilter = `batch_id.eq.${batchId},metadata->>batch_id.eq.${batchId}`;
      const { data, error: qErr } = await supabase
        .from("jobs")
        .select("id,created_at,filename,status,output_url,error,batch_id,html_preview_url,metadata")
        .or(orFilter)
        .order("created_at", { ascending: true });

      setExpandedLoading(false);
      if (qErr) {
        setExpandedJobs([]);
        return;
      }
      setExpandedJobs(((data ?? []) as BatchJobRow[]) || []);
    },
    [supabase],
  );

  const expandedRef = useRef<string | null>(null);
  useEffect(() => {
    expandedRef.current = expandedBatchId;
  }, [expandedBatchId]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    queueMicrotask(() => {
      void fetchBatchHistory();
    });

    const channel = supabase
      .channel("batches-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "batches" }, () => {
        void fetchBatchHistory();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        void fetchBatchHistory();
      })
      .subscribe();

    const poll = window.setInterval(() => {
      void fetchBatchHistory();
    }, POLL_MS);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [supabase, fetchBatchHistory]);

  useEffect(() => {
    if (!supabase || !activeBatchId) {
      return;
    }

    queueMicrotask(() => {
      void fetchBatchRows();
    });

    const channel = supabase
      .channel(`batch-jobs-live-${activeBatchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        void fetchBatchRows();
        const ex = expandedRef.current;
        if (ex) {
          void fetchExpandedJobs(ex);
        }
      })
      .subscribe();

    const poll = window.setInterval(() => {
      void fetchBatchRows();
      const ex = expandedRef.current;
      if (ex) {
        void fetchExpandedJobs(ex);
      }
    }, POLL_MS);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [supabase, activeBatchId, fetchBatchRows, fetchExpandedJobs]);

  useEffect(() => {
    if (!expandedBatchId || !supabase) {
      queueMicrotask(() => {
        setExpandedJobs([]);
      });
      return;
    }
    queueMicrotask(() => {
      void fetchExpandedJobs(expandedBatchId);
    });
  }, [expandedBatchId, supabase, fetchExpandedJobs]);

  const applyFiles = useCallback((list: FileList | File[] | null) => {
    setError(null);
    setLastSummary(null);
    if (!list || list.length === 0) {
      setFiles([]);
      return;
    }
    const next: File[] = [];
    const errs: string[] = [];
    for (const f of Array.from(list)) {
      const msg = validatePdfUpload(f);
      if (msg) {
        errs.push(`${f.name}: ${msg}`);
      } else {
        next.push(f);
      }
    }
    if (errs.length) {
      setError(errs.slice(0, 3).join(" ") + (errs.length > 3 ? " …" : ""));
    }
    if (next.length > MAX_BATCH_JOBS) {
      setError(`Select at most ${MAX_BATCH_JOBS} PDFs per batch.`);
      setFiles(next.slice(0, MAX_BATCH_JOBS));
      return;
    }
    setFiles(next);
  }, []);

  const runBatch = async () => {
    if (files.length === 0 || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setLastSummary(null);

    try {
      const batchId = await createEmptyBatch();
      setActiveBatchId(batchId);

      const jobIds = await mapPool(files, BATCH_UPLOAD_CONCURRENCY, (file) =>
        uploadOnePdf(file, batchId),
      );

      void fetchBatchRows();
      void fetchBatchHistory();

      const runResults = await mapPool(jobIds, BATCH_RUN_CONCURRENCY, (jobId) => runSingleBatchJob(jobId));

      const okCount = runResults.filter((r) => r.ok).length;
      const failCount = runResults.length - okCount;
      setLastSummary(
        `Finished ${runResults.length} job(s) in parallel (max ${BATCH_RUN_CONCURRENCY} at a time): ${okCount} succeeded, ${failCount} failed.`,
      );

      setFiles([]);
      void fetchBatchRows();
      void fetchBatchHistory();
      if (expandedBatchId === batchId) {
        void fetchExpandedJobs(batchId);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleExpandBatch = (id: string) => {
    setExpandedBatchId((prev) => (prev === id ? null : id));
  };

  const supabaseMissing = !supabase;

  return (
    <div className="space-y-6">
      {supabaseMissing ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Configure <code className="rounded bg-black/5 px-1">NEXT_PUBLIC_SUPABASE_*</code> to load job
          status updates and batch history.
        </p>
      ) : null}

      <div className="rounded-lg border border-black/15 bg-white p-6 shadow-sm">
        <label htmlFor={inputId} className="block text-sm font-medium text-black">
          PDF files (max {MAX_BATCH_JOBS})
        </label>
        <input
          id={inputId}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          disabled={busy}
          className="mt-2 block w-full text-sm text-black/80 file:mr-3 file:rounded-md file:border file:border-black/20 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:bg-black/5"
          onChange={(e) => applyFiles(e.target.files)}
        />

        {files.length > 0 ? (
          <ul className="mt-3 max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-sm text-black/80">
            {files.map((f) => (
              <li key={`${f.name}-${f.size}`}>{f.name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-black/60">No files selected.</p>
        )}

        <button
          type="button"
          disabled={busy || files.length === 0}
          onClick={() => void runBatch()}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-bny-navy px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-bny-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Working…" : "Upload and convert batch"}
        </button>

        <p className="mt-3 text-xs text-black/55">
          A new <code className="rounded bg-black/5 px-1">batches</code> row is created only when you click the
          button. Each PDF becomes one job linked to that batch id; conversions then run in parallel (up to{" "}
          {BATCH_RUN_CONCURRENCY} concurrent server jobs; non-streaming Agent 1). If batch creation fails, apply
          migration <code className="rounded bg-black/5 px-1">003_batches.sql</code>.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
      ) : null}

      {lastSummary ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {lastSummary}
        </p>
      ) : null}

      <div className="rounded-lg border border-black/15 bg-white shadow-sm">
        <div className="border-b border-black/10 px-4 py-3">
          <h2 className="text-base font-semibold text-black">Jobs in this batch</h2>
          <p className="mt-0.5 text-xs text-black/60">
            {activeBatchId ? (
              <>
                Last run: batch <code className="rounded bg-black/5 px-1">{activeBatchId.slice(0, 8)}…</code>{" "}
                (jobs with matching <code className="rounded bg-black/5 px-1">batch_id</code>).
              </>
            ) : (
              "No batch yet — click Upload and convert batch to create one and start jobs."
            )}
          </p>
        </div>
        <JobsTable
          rows={rows}
          emptyLabel="No jobs for the last run yet — start a batch with the button above."
          onPreview={(url) => setPreviewModalUrl(url)}
        />
      </div>

      {supabase ? (
        <div className="rounded-lg border border-black/15 bg-white shadow-sm">
          <div className="border-b border-black/10 px-4 py-3">
            <h2 className="text-base font-semibold text-black">Batch history</h2>
            <p className="mt-0.5 text-xs text-black/60">
              Recent batches from <code className="rounded bg-black/5 px-1">public.batches</code>. Expand a
              row to see all jobs in that batch.
            </p>
          </div>
          <ul className="divide-y divide-black/10">
            {batchHistory.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-black/55">No batches recorded yet.</li>
            ) : (
              batchHistory.map((b) => {
                const isOpen = expandedBatchId === b.id;
                const isActive = activeBatchId === b.id;
                return (
                  <li key={b.id} className="bg-white">
                    <button
                      type="button"
                      onClick={() => toggleExpandBatch(b.id)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-black/[0.02]"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? (
                        <ChevronDown className="size-4 shrink-0 text-black/60" aria-hidden />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-black/60" aria-hidden />
                      )}
                      <span className="font-medium text-black">{DATE_FMT.format(new Date(b.created_at))}</span>
                      <span className="truncate text-black/55">
                        <code className="rounded bg-black/5 px-1">{b.id.slice(0, 8)}…</code>
                        {isActive ? (
                          <span className="ml-2 rounded-full border border-bny-teal/40 bg-bny-teal/10 px-2 py-0.5 text-xs text-bny-navy">
                            current session
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {isOpen ? (
                      <div className="border-t border-black/10 bg-black/[0.02] px-2 pb-4 pt-2">
                        {expandedLoading ? (
                          <p className="px-2 py-4 text-center text-sm text-black/55">Loading jobs…</p>
                        ) : (
                          <JobsTable
                            rows={expandedJobs}
                            emptyLabel="No jobs linked to this batch (legacy rows may only have metadata.batch_id)."
                            onPreview={(url) => setPreviewModalUrl(url)}
                          />
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}

      <HtmlPreviewModal
        key={previewModalUrl ?? "html-preview-closed"}
        open={previewModalUrl != null}
        url={previewModalUrl}
        onClose={() => setPreviewModalUrl(null)}
      />
    </div>
  );
}
