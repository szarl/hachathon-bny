import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  runConversionPipeline,
  type ConversionPipelineBody,
  type ConversionSseEvent,
} from "@/lib/conversion-pipeline";
import { getErrorMessage, setJobStatus as updateJobStatus } from "@/lib/jobs";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
// Agent streaming + validation + in-memory ZIP: within Vercel Hobby limit; raise on Pro if timeouts occur.
export const maxDuration = 60;

type SseEvent = ConversionSseEvent | { type: "error"; error: string };

export async function POST(req: NextRequest) {
  let body: ConversionPipelineBody;

  try {
    body = (await req.json()) as ConversionPipelineBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body.jobId && !Array.isArray(body.topics)) {
    return NextResponse.json(
      { error: "Request body must include jobId or classified topics." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await runConversionPipeline({
          body,
          agent1Mode: "stream",
          emit: (event) => send(event),
        });
      } catch (error) {
        const message = getErrorMessage(error);

        if (body.jobId) {
          await setJobStatus(body.jobId, "error", { error: message }).catch(() => undefined);
        }

        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function setJobStatus(
  jobId: string,
  status: Parameters<typeof updateJobStatus>[1],
  extra: Record<string, unknown> = {},
) {
  return updateJobStatus(jobId, status, extra, getSupabaseAdmin());
}
