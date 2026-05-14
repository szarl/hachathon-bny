import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  buildUserMessage as buildClassifyUserMessage,
  normalizeClassifiedTopics,
  parseClassifiedTopics,
  type ClassifiedTopic,
  type ExtractedPage,
} from "@/lib/classify";
import {
  buildFormattingRepairMessage,
  buildGenerateUserMessage,
  buildValidationUserMessage,
  collectExtractedAssets,
  parseFiles,
  parseValidationResult,
  pickXmlTextFilesForSse,
  runDeterministicChecks,
  uploadFilesToStorage,
  type AssetSummary,
  type ExtractedAsset,
  type JobMetadata,
  type ValidationIssue,
  type ValidationResult,
} from "@/lib/generate";
import { geminiModels, getGeminiClient } from "@/lib/gemini";
import { getErrorMessage, setJobStatus as updateJobStatus } from "@/lib/jobs";
import { AGENT_1_SYSTEM_PROMPT, AGENT_2_SYSTEM_PROMPT, CLASSIFY_SYSTEM_PROMPT } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
// Agent streaming + validation + in-memory ZIP: within Vercel Hobby limit; raise on Pro if timeouts occur.
export const maxDuration = 60;

type GenerateRequestBody = {
  jobId?: string;
  documentTitle?: string;
  topics?: unknown[];
};

type ResolvedGenerationInput = {
  topics: ClassifiedTopic[];
  assets: ExtractedAsset[];
};

type SseEvent =
  | { type: "stage"; stage: string; label: string }
  | { type: "topics"; topics: ClassifiedTopic[] }
  | { type: "token"; text: string }
  | { type: "agent1_done"; fileCount: number }
  | { type: "validation"; passed: boolean; issueCount: number; issues: ValidationIssue[] }
  | { type: "files"; files: Record<string, string> }
  | { type: "assets"; assets: AssetSummary[] }
  | { type: "done"; outputUrl: string; metadata: JobMetadata }
  | { type: "error"; error: string };

export async function POST(req: NextRequest) {
  let body: GenerateRequestBody;

  try {
    body = (await req.json()) as GenerateRequestBody;
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
        const { topics, assets } = await resolveTopics(body, send);

        if (topics.length === 0) {
          throw new Error("No classified topics are available for DITA generation.");
        }

        if (body.jobId) {
          await setJobStatus(body.jobId, "generating");
        }

        send({
          type: "stage",
          stage: "generating",
          label: "Agent 1 — generating DITA",
        });

        const agent1Files = await runAgent1({
          documentTitle: body.documentTitle,
          topics,
          onToken: (text) => send({ type: "token", text }),
        });

        send({ type: "agent1_done", fileCount: Object.keys(agent1Files).length });

        if (body.jobId) {
          await setJobStatus(body.jobId, "validating");
        }

        send({
          type: "stage",
          stage: "validating",
          label: "Agent 2 — validating XML",
        });

        const deterministicIssues = await runDeterministicChecks(
          agent1Files,
          assets
            .filter((asset) => asset.dataBase64 && !asset.skipped)
            .map((asset) => `images/${asset.filename.split(/[\\/]/).pop() ?? asset.filename}`),
        );
        const validation = await runAgent2(agent1Files, deterministicIssues);

        send({
          type: "validation",
          passed: validation.passed,
          issueCount: validation.issueCount,
          issues: validation.issues,
        });

        if (body.jobId) {
          await setJobStatus(body.jobId, "saving");
          send({ type: "stage", stage: "saving", label: "Saving ZIP" });

          const upload = await uploadFilesToStorage(
            body.jobId,
            validation.files,
            assets,
            validation,
            new Date(),
            getSupabaseAdmin(),
          );

          await setJobStatus(body.jobId, "done", {
            output_url: upload.outputUrl,
            topics,
            metadata: upload.metadata,
          });

          send({ type: "files", files: pickXmlTextFilesForSse(validation.files) });
          send({ type: "assets", assets: upload.assets });
          send({ type: "done", outputUrl: upload.outputUrl, metadata: upload.metadata });
        } else {
          send({ type: "files", files: pickXmlTextFilesForSse(validation.files) });
        }
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

async function resolveTopics(
  body: GenerateRequestBody,
  send: (event: SseEvent) => void,
): Promise<ResolvedGenerationInput> {
  if (Array.isArray(body.topics)) {
    return { topics: normalizeClassifiedTopics(body.topics), assets: [] };
  }

  if (!body.jobId) {
    throw new Error("Request body must include jobId when topics are not provided.");
  }

  send({ type: "stage", stage: "extracting", label: "Extracting PDF" });
  await setJobStatus(body.jobId, "extracting");

  const pdfUrl = await getJobPdfUrl(body.jobId);
  const extractedPages = await extractPdf(pdfUrl);
  const assets = collectExtractedAssets(extractedPages);

  send({ type: "stage", stage: "classifying", label: "Classifying topics" });
  await setJobStatus(body.jobId, "classifying");

  const topics = await classifyExtractedPages(extractedPages);
  send({ type: "topics", topics });

  return { topics, assets };
}

async function runAgent1({
  documentTitle,
  topics,
  onToken,
}: {
  documentTitle?: string;
  topics: ClassifiedTopic[];
  onToken: (text: string) => void;
}): Promise<Record<string, string>> {
  const ai = getGeminiClient();
  const userMessage = buildGenerateUserMessage({ documentTitle, topics });
  const stream = await ai.models.generateContentStream({
    model: geminiModels.generate,
    contents: userMessage,
    config: {
      systemInstruction: AGENT_1_SYSTEM_PROMPT,
      temperature: 0.1,
    },
  });

  let fullText = "";

  for await (const chunk of stream) {
    const text = chunk.text ?? "";

    if (text) {
      fullText += text;
      onToken(text);
    }
  }

  try {
    return parseFiles(fullText);
  } catch {
    return repairDelimitedOutput(fullText);
  }
}

async function runAgent2(
  files: Record<string, string>,
  deterministicIssues: ValidationIssue[],
): Promise<ValidationResult> {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: geminiModels.validate,
    contents: buildValidationUserMessage({ files, deterministicIssues }),
    config: {
      systemInstruction: AGENT_2_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      temperature: 0,
    },
  });

  return parseValidationResult(response.text ?? "");
}

async function repairDelimitedOutput(rawOutput: string): Promise<Record<string, string>> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: geminiModels.generate,
    contents: buildFormattingRepairMessage(rawOutput),
    config: {
      systemInstruction: AGENT_1_SYSTEM_PROMPT,
      temperature: 0,
    },
  });

  return parseFiles(response.text ?? "");
}

async function classifyExtractedPages(extractedPages: ExtractedPage[]): Promise<ClassifiedTopic[]> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: geminiModels.classify,
    contents: buildClassifyUserMessage(extractedPages),
    config: {
      systemInstruction: CLASSIFY_SYSTEM_PROMPT,
      temperature: 0,
    },
  });

  let topics: ClassifiedTopic[];

  try {
    topics = parseClassifiedTopics(response.text ?? "");
  } catch {
    topics = await repairClassifiedJson(response.text ?? "");
  }

  if (topics.length === 0) {
    throw new Error("Classification returned no usable topics.");
  }

  return topics;
}

async function repairClassifiedJson(brokenOutput: string): Promise<ClassifiedTopic[]> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: geminiModels.classify,
    contents:
      "The following output was supposed to be a valid JSON array of ClassifiedTopic objects " +
      "but failed to parse. Fix the JSON syntax and return only the corrected JSON array, " +
      `no markdown fences, no explanation:\n\n${brokenOutput}`,
    config: {
      temperature: 0,
    },
  });

  return parseClassifiedTopics(response.text ?? "");
}

async function getJobPdfUrl(jobId: string): Promise<string> {
  const { data: job, error } = await getSupabaseAdmin()
    .from("jobs")
    .select("id,pdf_url")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  if (!job?.pdf_url) {
    throw new Error("Job does not have an uploaded PDF URL.");
  }

  return job.pdf_url;
}

async function extractPdf(pdfUrl: string): Promise<ExtractedPage[]> {
  const pdfResponse = await fetch(pdfUrl);

  if (!pdfResponse.ok) {
    throw new Error(`Failed to download uploaded PDF: ${pdfResponse.status}`);
  }

  const formData = new FormData();
  formData.append("file", await pdfResponse.blob(), "source.pdf");

  const extractResponse = await fetch(getExtractApiUrl(), {
    method: "POST",
    body: formData,
  });

  const payload = (await extractResponse.json()) as {
    extractedPages?: ExtractedPage[];
    error?: string;
  };

  if (!extractResponse.ok) {
    throw new Error(payload.error ?? `PDF extraction failed: ${extractResponse.status}`);
  }

  if (!Array.isArray(payload.extractedPages)) {
    throw new Error("PDF extraction response did not include extractedPages.");
  }

  return payload.extractedPages;
}

function getExtractApiUrl(): string {
  return process.env.EXTRACT_API_URL ?? "http://127.0.0.1:8001/api/extract";
}

async function setJobStatus(
  jobId: string,
  status: Parameters<typeof updateJobStatus>[1],
  extra: Record<string, unknown> = {},
) {
  return updateJobStatus(jobId, status, extra, getSupabaseAdmin());
}
