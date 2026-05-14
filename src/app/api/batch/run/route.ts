import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { MAX_BATCH_JOBS } from "@/lib/batch-config";
import { runConversionPipeline } from "@/lib/conversion-pipeline";
import { documentTitleFromFilename, getErrorMessage, setJobStatus } from "@/lib/jobs";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

type BatchRunBody = {
  jobIds?: unknown;
  documentTitles?: unknown;
};

export async function POST(req: NextRequest) {
  let body: BatchRunBody;

  try {
    body = (await req.json()) as BatchRunBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const jobIds = body.jobIds;
  if (!Array.isArray(jobIds)) {
    return NextResponse.json({ error: "jobIds must be an array." }, { status: 400 });
  }

  if (jobIds.length === 0) {
    return NextResponse.json({ error: "jobIds must be a non-empty array." }, { status: 400 });
  }

  if (jobIds.length > MAX_BATCH_JOBS) {
    return NextResponse.json(
      { error: `At most ${MAX_BATCH_JOBS} jobs per batch request.` },
      { status: 400 },
    );
  }

  const titlesRaw = body.documentTitles;
  const documentTitles: Record<string, string> = {};
  if (titlesRaw && typeof titlesRaw === "object" && !Array.isArray(titlesRaw)) {
    for (const [key, value] of Object.entries(titlesRaw as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) {
        documentTitles[key] = value.trim();
      }
    }
  }

  const supabase = getSupabaseAdmin();

  const results: Array<{
    jobId: string;
    ok: boolean;
    outputUrl?: string | null;
    metadata?: unknown;
    error?: string;
  }> = [];

  for (const rawId of jobIds) {
    if (typeof rawId !== "string" || !rawId.trim()) {
      results.push({
        jobId: typeof rawId === "string" ? rawId : "(invalid)",
        ok: false,
        error: "Invalid job id.",
      });
      continue;
    }

    const jobId = rawId.trim();

    try {
      const { data: job, error: fetchError } = await supabase
        .from("jobs")
        .select("filename")
        .eq("id", jobId)
        .single();

      if (fetchError || !job?.filename) {
        throw new Error(fetchError ? getErrorMessage(fetchError) : "Job not found.");
      }

      const documentTitle =
        documentTitles[jobId] ?? documentTitleFromFilename(String(job.filename));

      const out = await runConversionPipeline({
        body: { jobId, documentTitle },
        agent1Mode: "single",
      });

      results.push({
        jobId,
        ok: true,
        outputUrl: out.outputUrl,
        metadata: out.metadata,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      await setJobStatus(jobId, "error", { error: message }, supabase).catch(() => undefined);
      results.push({ jobId, ok: false, error: message });
    }
  }

  return NextResponse.json({ results });
}
