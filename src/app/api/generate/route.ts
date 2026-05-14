import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getErrorMessage, setJobStatus as updateJobStatus, type JobStatus } from "@/lib/jobs";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateRequestBody = {
  jobId?: string;
  documentTitle?: string;
};

export async function POST(req: NextRequest) {
  let body: GenerateRequestBody;

  try {
    body = (await req.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body.jobId) {
    return NextResponse.json({ error: "Request body must include jobId." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    await setJobStatus(body.jobId, "extracting");

    const { data: job, error } = await supabase
      .from("jobs")
      .select("id,pdf_url")
      .eq("id", body.jobId)
      .single();

    if (error) {
      throw new Error(getErrorMessage(error));
    }

    if (!job?.pdf_url) {
      throw new Error("Job does not have an uploaded PDF URL.");
    }

    return NextResponse.json(
      {
        jobId: body.jobId,
        documentTitle: body.documentTitle ?? null,
        pdfUrl: job.pdf_url,
        message: "Generation pipeline begins in PRD-06.",
      },
      { status: 202 },
    );
  } catch (error) {
    const message = getErrorMessage(error);
    await setJobStatus(body.jobId, "error", { error: message }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function setJobStatus(
  jobId: string,
  status: JobStatus,
  extra: Record<string, unknown> = {},
) {
  return updateJobStatus(jobId, status, extra, getSupabaseAdmin());
}
