"use client";

import { useCallback, useEffect, useState } from "react";

import { getSupabaseBrowser } from "@/lib/supabase-browser";

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
    return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200";
  }
  if (status === "error") {
    return "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
  }
  if (status === "generating") {
    return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200";
  }
  return "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function openDownload(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function JobHistory() {
  const [jobs, setJobs] = useState<JobHistoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();

  const fetchJobs = useCallback(async () => {
    if (!supabase) {
      setLoadError("Supabase is not configured.");
      return;
    }

    const { data, error } = await supabase
      .from("jobs")
      .select("id,created_at,filename,status,output_url")
      .order("created_at", { ascending: false })
      .limit(JOB_HISTORY_LIMIT);

    if (error) {
      setLoadError(error.message);
      return;
    }

    setLoadError(null);
    setJobs(sliceLimit((data ?? []) as JobHistoryRow[]));
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase is not configured.");
      return;
    }

    void fetchJobs();

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

          const row = payload.new as JobHistoryRow | null;
          if (!row?.id) {
            return;
          }

          setJobs((prev) => {
            const others = prev.filter((j) => j.id !== row.id);
            return sliceLimit([row, ...others]);
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
        className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        aria-label="Job history"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Recent jobs</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to load history.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Job history"
    >
      <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">Recent jobs</h2>

      {loadError ? (
        <p className="mb-3 text-sm text-amber-800 dark:text-amber-200" role="status">
          {loadError}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="pb-2 pr-3 font-medium text-zinc-600 dark:text-zinc-400">Filename</th>
              <th className="pb-2 pr-3 font-medium text-zinc-600 dark:text-zinc-400">Created</th>
              <th className="pb-2 pr-3 font-medium text-zinc-600 dark:text-zinc-400">Status</th>
              <th className="pb-2 font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-zinc-500 dark:text-zinc-400">
                  No jobs yet.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="max-w-[200px] truncate py-2.5 pr-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {job.filename}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-zinc-600 dark:text-zinc-400">
                    {DATE_FMT.format(new Date(job.created_at))}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${badgeClasses(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="py-2.5">
                    {job.status === "done" && job.output_url ? (
                      <button
                        type="button"
                        onClick={() => openDownload(job.output_url!)}
                        className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
                      >
                        Download
                      </button>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
