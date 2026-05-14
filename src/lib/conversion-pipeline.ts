import "server-only";

import {
  attachPageImagesToTopics,
  buildUserMessage as buildClassifyUserMessage,
  normalizeClassifiedTopics,
  parseClassifiedTopics,
  stabilizeCapsAndFloorsTest5Topics,
  type ClassifiedTopic,
  type ExtractedPage,
} from "@/lib/classify";
import {
  buildFormattingRepairMessage,
  buildGeminiOutputBudgetPreamble,
  buildGenerateUserMessage,
  buildValidationUserMessage,
  collectExtractedAssets,
  ensureRelatedImageFigures,
  expectedFilesForTopics,
  parseFiles,
  parseValidationResult,
  pickXmlTextFilesForSse,
  preserveRequiredFiles,
  runDeterministicChecks,
  uploadFilesToStorage,
  validationResultWithoutAgent2,
  type AssetSummary,
  type ExtractedAsset,
  type JobMetadata,
  type ValidationIssue,
  type ValidationResult,
} from "@/lib/generate";
import { withGeminiRetries } from "@/lib/gemini-retry";
import {
  geminiModels,
  getGeminiClient,
  isGeminiAgent2Enabled,
  maxAgent1OutputTokens,
  maxAgent2OutputTokens,
} from "@/lib/gemini";
import { getErrorMessage, setJobStatus as updateJobStatus } from "@/lib/jobs";
import { AGENT_1_SYSTEM_PROMPT, AGENT_2_SYSTEM_PROMPT, CLASSIFY_SYSTEM_PROMPT } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";

export type ConversionPipelineBody = {
  jobId?: string;
  documentTitle?: string;
  topics?: unknown[];
};

/** SSE payloads emitted during interactive conversion (errors throw instead). */
export type ConversionSseEvent =
  | { type: "stage"; stage: string; label: string }
  | { type: "topics"; topics: ClassifiedTopic[] }
  | { type: "token"; text: string }
  | { type: "agent1_done"; fileCount: number }
  | {
      type: "validation";
      passed: boolean;
      issueCount: number;
      issues: ValidationIssue[];
      agent2Skipped?: boolean;
    }
  | { type: "files"; files: Record<string, string> }
  | { type: "assets"; assets: AssetSummary[] }
  | { type: "done"; outputUrl: string; metadata: JobMetadata };

export type ConversionPipelineOutput = {
  topics: ClassifiedTopic[];
  outputUrl: string | null;
  metadata: JobMetadata | null;
  filesForEditor: Record<string, string>;
  assets: AssetSummary[];
};

type ResolvedGenerationInput = {
  topics: ClassifiedTopic[];
  assets: ExtractedAsset[];
};

export async function runConversionPipeline(args: {
  body: ConversionPipelineBody;
  agent1Mode: "stream" | "single";
  emit?: (event: ConversionSseEvent) => void;
}): Promise<ConversionPipelineOutput> {
  const { body, agent1Mode } = args;
  const emit = args.emit ?? (() => undefined);

  const { topics, assets } = await resolveTopics(body, emit);

  if (topics.length === 0) {
    throw new Error("No classified topics are available for DITA generation.");
  }

  if (body.jobId) {
    await setJobStatus(body.jobId, "generating");
  }

  emit({
    type: "stage",
    stage: "generating",
    label: "Agent 1 — generating DITA",
  });

  const agent1Files = ensureRelatedImageFigures(
    await runAgent1({
      documentTitle: body.documentTitle,
      topics,
      mode: agent1Mode,
      onToken: (text) => emit({ type: "token", text }),
    }),
    topics,
    assets,
  );
  const requiredFiles = expectedFilesForTopics(topics);

  emit({ type: "agent1_done", fileCount: Object.keys(agent1Files).length });

  const deterministicIssues = await runDeterministicChecks(
    agent1Files,
    assets
      .filter((asset) => asset.dataBase64 && !asset.skipped)
      .map((asset) => `images/${asset.filename.split(/[\\/]/).pop() ?? asset.filename}`),
    requiredFiles,
  );

  if (body.jobId) {
    await setJobStatus(body.jobId, "validating");
  }

  const agent2Enabled = isGeminiAgent2Enabled();
  let validation: ValidationResult;

  if (agent2Enabled) {
    emit({
      type: "stage",
      stage: "validating",
      label: "Agent 2 — validating XML",
    });

    validation = await runAgent2(agent1Files, deterministicIssues);
    validation = {
      ...validation,
      files: ensureRelatedImageFigures(
        preserveRequiredFiles(validation.files, agent1Files, requiredFiles),
        topics,
        assets,
      ),
    };

    emit({
      type: "validation",
      passed: validation.passed,
      issueCount: validation.issueCount,
      issues: validation.issues,
    });
  } else {
    emit({
      type: "stage",
      stage: "validating",
      label: "Agent 2 skipped (GEMINI_AGENT2_ENABLED=false)",
    });

    validation = validationResultWithoutAgent2(agent1Files, deterministicIssues);
    validation = {
      ...validation,
      files: ensureRelatedImageFigures(
        preserveRequiredFiles(validation.files, agent1Files, requiredFiles),
        topics,
        assets,
      ),
    };

    emit({
      type: "validation",
      passed: validation.passed,
      issueCount: validation.issueCount,
      issues: validation.issues,
      agent2Skipped: true,
    });
  }

  if (body.jobId) {
    await setJobStatus(body.jobId, "saving");
    emit({ type: "stage", stage: "saving", label: "Saving ZIP" });

    const upload = await uploadFilesToStorage(
      body.jobId,
      validation.files,
      assets,
      validation,
      new Date(),
      getSupabaseAdmin(),
    );

    const donePayload: Record<string, unknown> = {
      output_url: upload.outputUrl,
      topics,
      metadata: upload.metadata,
      html_preview_url: upload.metadata.htmlPreviewUrl ?? null,
    };

    try {
      await setJobStatus(body.jobId, "done", donePayload);
    } catch (statusError) {
      const msg = getErrorMessage(statusError);
      if (/html_preview_url/i.test(msg) || /column .* does not exist/i.test(msg)) {
        const withoutCol = { ...donePayload };
        delete withoutCol.html_preview_url;
        await setJobStatus(body.jobId, "done", withoutCol);
      } else {
        throw statusError;
      }
    }

    const filesForEditor = pickXmlTextFilesForSse(validation.files);
    emit({ type: "files", files: filesForEditor });
    emit({ type: "assets", assets: upload.assets });
    emit({ type: "done", outputUrl: upload.outputUrl, metadata: upload.metadata });

    return {
      topics,
      outputUrl: upload.outputUrl,
      metadata: upload.metadata,
      filesForEditor,
      assets: upload.assets,
    };
  }

  const filesForEditor = pickXmlTextFilesForSse(validation.files);
  emit({ type: "files", files: filesForEditor });

  return {
    topics,
    outputUrl: null,
    metadata: null,
    filesForEditor,
    assets: [],
  };
}

async function resolveTopics(
  body: ConversionPipelineBody,
  emit: (event: ConversionSseEvent) => void,
): Promise<ResolvedGenerationInput> {
  if (Array.isArray(body.topics)) {
    return { topics: normalizeClassifiedTopics(body.topics), assets: [] };
  }

  if (!body.jobId) {
    throw new Error("Request body must include jobId when topics are not provided.");
  }

  emit({ type: "stage", stage: "extracting", label: "Extracting PDF" });
  await setJobStatus(body.jobId, "extracting");

  const pdfUrl = await getJobPdfUrl(body.jobId);
  const extractedPages = await extractPdf(pdfUrl);
  const extractedAssets = collectExtractedAssets(extractedPages);

  emit({ type: "stage", stage: "classifying", label: "Classifying topics" });
  await setJobStatus(body.jobId, "classifying");

  const classifiedTopics = await classifyExtractedPages(extractedPages);
  const stableTopics = stabilizeCapsAndFloorsTest5Topics(classifiedTopics, extractedPages);
  const topicsWithPageImages = attachPageImagesToTopics(stableTopics, extractedPages);
  emit({ type: "topics", topics: topicsWithPageImages });

  return { topics: topicsWithPageImages, assets: extractedAssets };
}

async function runAgent1({
  documentTitle,
  topics,
  mode,
  onToken,
}: {
  documentTitle?: string;
  topics: ClassifiedTopic[];
  mode: "stream" | "single";
  onToken: (text: string) => void;
}): Promise<Record<string, string>> {
  const ai = getGeminiClient();
  const maxOut = maxAgent1OutputTokens();
  const userMessage = buildGenerateUserMessage({ documentTitle, topics }, { maxOutputTokens: maxOut });

  if (mode === "single") {
    const response = await withGeminiRetries(() =>
      ai.models.generateContent({
        model: geminiModels.generate,
        contents: userMessage,
        config: {
          systemInstruction: AGENT_1_SYSTEM_PROMPT,
          temperature: 0,
          maxOutputTokens: maxOut,
        },
      }),
    );

    const fullText = response.text ?? "";

    try {
      return parseFiles(fullText);
    } catch {
      return repairDelimitedOutput(fullText);
    }
  }

  const stream = await withGeminiRetries(() =>
    ai.models.generateContentStream({
      model: geminiModels.generate,
      contents: userMessage,
      config: {
        systemInstruction: AGENT_1_SYSTEM_PROMPT,
        temperature: 0,
        maxOutputTokens: maxOut,
      },
    }),
  );

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
  const maxOut = maxAgent2OutputTokens();
  const response = await withGeminiRetries(() =>
    ai.models.generateContent({
      model: geminiModels.validate,
      contents: buildValidationUserMessage({ files, deterministicIssues }, { maxOutputTokens: maxOut }),
      config: {
        systemInstruction: AGENT_2_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        maxOutputTokens: maxOut,
        temperature: 0,
      },
    }),
  );

  return parseValidationResult(response.text ?? "");
}

async function repairDelimitedOutput(rawOutput: string): Promise<Record<string, string>> {
  const ai = getGeminiClient();
  const maxOut = maxAgent1OutputTokens();
  const response = await withGeminiRetries(() =>
    ai.models.generateContent({
      model: geminiModels.generate,
      contents:
        buildGeminiOutputBudgetPreamble(maxOut, "agent1-xml") + buildFormattingRepairMessage(rawOutput),
      config: {
        systemInstruction: AGENT_1_SYSTEM_PROMPT,
        temperature: 0,
        maxOutputTokens: maxOut,
      },
    }),
  );

  return parseFiles(response.text ?? "");
}

async function classifyExtractedPages(extractedPages: ExtractedPage[]): Promise<ClassifiedTopic[]> {
  const ai = getGeminiClient();
  const response = await withGeminiRetries(() =>
    ai.models.generateContent({
      model: geminiModels.classify,
      contents: buildClassifyUserMessage(extractedPages),
      config: {
        systemInstruction: CLASSIFY_SYSTEM_PROMPT,
        temperature: 0,
      },
    }),
  );

  let classifiedTopics: ClassifiedTopic[];

  try {
    classifiedTopics = parseClassifiedTopics(response.text ?? "");
  } catch {
    classifiedTopics = await repairClassifiedJson(response.text ?? "");
  }

  if (classifiedTopics.length === 0) {
    throw new Error("Classification returned no usable topics.");
  }

  return classifiedTopics;
}

async function repairClassifiedJson(brokenOutput: string): Promise<ClassifiedTopic[]> {
  const ai = getGeminiClient();
  const response = await withGeminiRetries(() =>
    ai.models.generateContent({
      model: geminiModels.classify,
      contents:
        "The following output was supposed to be a valid JSON array of ClassifiedTopic objects " +
        "but failed to parse. Fix the JSON syntax and return only the corrected JSON array, " +
        `no markdown fences, no explanation:\n\n${brokenOutput}`,
      config: {
        temperature: 0,
      },
    }),
  );

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

export function getExtractApiUrl(): string {
  const explicit = process.env.EXTRACT_API_URL?.trim();
  if (explicit) {
    return explicit;
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl}/api/extract`;
  }
  return "http://127.0.0.1:8001/api/extract";
}

async function setJobStatus(
  jobId: string,
  status: Parameters<typeof updateJobStatus>[1],
  extra: Record<string, unknown> = {},
) {
  return updateJobStatus(jobId, status, extra, getSupabaseAdmin());
}
