import type { ClassifiedTopic, ExtractedPage } from "./classify";
import { getErrorMessage } from "@/lib/error-message";
import { parseDelimitedDitaOutput } from "./parse-delimited-dita-output";

export type ValidationIssue = {
  rule: string;
  severity: "error" | "warning" | "info";
  file?: string;
  message: string;
  fixed?: boolean;
};

export type ValidationResult = {
  passed: boolean;
  issueCount: number;
  issues: ValidationIssue[];
  files: Record<string, string>;
  /** Set when Agent 2 was not run; output files are still Agent 1 (+ deterministic context only). */
  agent2Skipped?: boolean;
};

export type ExtractedAsset = NonNullable<ExtractedPage["images"]>[number];

export type AssetSummary = {
  path: string;
  filename: string;
  pageNumber: number;
  mimeType: string;
  status: "used" | "skipped";
  warning?: string;
};

export type JobMetadata = {
  topicCount: number;
  fileCount: number;
  usedAssetCount: number;
  skippedAssetCount: number;
  validationPassed: boolean;
  validationIssueCount: number;
  /** True when `GEMINI_AGENT2_ENABLED` disabled Agent 2 on the server. */
  agent2ValidationSkipped?: boolean;
};

export type StorageUploadResult = {
  outputUrl: string;
  path: string;
  metadata: JobMetadata;
  assets: AssetSummary[];
};

type StorageLike = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Buffer,
        options: { cacheControl: string; contentType: string; upsert: boolean },
      ): Promise<{ error: unknown }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
};

export type GenerateRequest = {
  documentTitle?: string;
  topics: ClassifiedTopic[];
};

export function buildGenerateUserMessage(req: GenerateRequest): string {
  const documentTitle = req.documentTitle?.trim() || "Untitled document";
  const topicList = req.topics
    .map(
      (topic, index) =>
        `### Topic ${index + 1}: ${topic.type.toUpperCase()} - "${topic.title}"\n` +
        `Suggested filename: ${ensureDitaExtension(topic.suggestedFilename)}\n` +
        `Confidence: ${topic.confidence}\n` +
        (topic.sourcePages?.length ? `Source pages: ${topic.sourcePages.join(", ")}\n` : "") +
        (topic.relatedImages?.length
          ? `Related images: ${topic.relatedImages.join(", ")}\n`
          : "") +
        `Content:\n${topic.content}`,
    )
    .join("\n\n");

  return (
    "Generate DITA XML files for the following document.\n\n" +
    `Document title: ${documentTitle}\n` +
    "Product name for keydef: BNY Platform\n" +
    `Number of topics: ${req.topics.length}\n\n` +
    `${topicList}\n\n` +
    "Output one .dita file per topic plus one fixed map.ditamap file.\n" +
    "Use the %%FILE:filename%% and %%END%% delimiters.\n" +
    "The ditamap must be named map.ditamap and must be the last file."
  );
}

export function parseFiles(raw: string): Record<string, string> {
  const loose = parseDelimitedDitaOutput(raw);
  const files: Record<string, string> = Object.fromEntries(
    Object.entries(loose).filter(([, content]) => Boolean(content)),
  );

  const filenames = Object.keys(files);

  if (filenames.length === 0) {
    throw new Error("No DITA files were found in Agent 1 output.");
  }

  if (!files["map.ditamap"]) {
    throw new Error("Agent 1 output must include map.ditamap.");
  }

  return files;
}

export function buildFormattingRepairMessage(rawOutput: string): string {
  return (
    "The following Agent 1 output was supposed to use %%FILE:filename%% delimiters " +
    "and end with %%END%%, but the application could not parse it.\n\n" +
    "Repair only the formatting and delimiters. Preserve the XML content. Return only " +
    "the corrected file-delimited output, with map.ditamap last.\n\n" +
    rawOutput
  );
}

export function buildValidationUserMessage({
  files,
  deterministicIssues,
}: {
  files: Record<string, string>;
  deterministicIssues: ValidationIssue[];
}): string {
  const issueContext =
    deterministicIssues.length > 0
      ? JSON.stringify(deterministicIssues, null, 2)
      : "[]";
  const filePayload = Object.entries(files)
    .map(([filename, content]) => `%%FILE:${filename}%%\n${content}`)
    .join("\n\n");

  return (
    "Validate and repair this complete DITA file set.\n\n" +
    "Deterministic issues to repair before returning final files:\n" +
    `${issueContext}\n\n` +
    "Input files:\n" +
    `${filePayload}\n\n` +
    "Return only JSON that matches the requested ValidationResult schema."
  );
}

export function parseValidationResult(raw: string): ValidationResult {
  const text = stripJsonFence(raw);
  const parsed = JSON.parse(text) as Partial<ValidationResult>;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Agent 2 validation response was not a JSON object.");
  }

  if (!parsed.files || typeof parsed.files !== "object" || Array.isArray(parsed.files)) {
    throw new Error("Agent 2 validation response did not include files.");
  }

  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.map(normalizeValidationIssue)
    : [];

  return {
    passed: Boolean(parsed.passed),
    issueCount:
      typeof parsed.issueCount === "number" && Number.isFinite(parsed.issueCount)
        ? parsed.issueCount
        : issues.length,
    issues,
    files: normalizeFiles(parsed.files),
  };
}

/** Validation result when Agent 2 is disabled: same files as Agent 1, optional basic issues. */
export function validationResultWithoutAgent2(
  files: Record<string, string>,
  deterministicIssues: ValidationIssue[],
): ValidationResult {
  const errors = deterministicIssues.filter((i) => i.severity === "error");
  return {
    passed: errors.length === 0,
    issueCount: deterministicIssues.length,
    issues: deterministicIssues,
    files,
    agent2Skipped: true,
  };
}

export async function runDeterministicChecks(
  files: Record<string, string>,
  availableAssets: string[] = [],
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const filenames = new Set(Object.keys(files));

  if (!files["map.ditamap"]) {
    issues.push({
      rule: "MAP_COMPLETENESS",
      severity: "error",
      file: "map.ditamap",
      message: "map.ditamap is missing.",
      fixed: false,
    });
  }

  await addXmlWellFormedIssues(files, issues);
  addMapCompletenessIssues(files, filenames, issues);
  addImageIssues(files, new Set(availableAssets), issues);

  return issues;
}

export function collectExtractedAssets(pages: ExtractedPage[]): ExtractedAsset[] {
  return pages.flatMap((page) => page.images ?? []);
}

/** Subset of `files` for SSE `files` events: XML topics and ditamaps only (no stray JSON keys). */
export function pickXmlTextFilesForSse(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).filter(
      ([name]) => name.endsWith(".dita") || name.endsWith(".ditamap"),
    ),
  );
}

export async function uploadFilesToStorage(
  jobId: string,
  files: Record<string, string>,
  assets: ExtractedAsset[] = [],
  validation: Pick<ValidationResult, "passed" | "issueCount" | "agent2Skipped">,
  now = new Date(),
  supabase: StorageLike,
): Promise<StorageUploadResult> {
  const zipModule = await import("jszip");
  const JSZip = zipModule.default ?? zipModule;
  const zip = new JSZip();

  for (const [filename, content] of Object.entries(files)) {
    zip.file(filename, content);
  }

  const referencedAssets = getReferencedAssetPaths(files);
  const assetSummaries: AssetSummary[] = [];
  let usedAssetCount = 0;

  for (const asset of assets) {
    const path = normalizeAssetPath(asset.filename);
    const isReferenced = referencedAssets.has(path);
    const canInclude = isReferenced && Boolean(asset.dataBase64) && !asset.skipped;

    if (canInclude) {
      zip.file(path, Buffer.from(asset.dataBase64 as string, "base64"));
      usedAssetCount += 1;
    }

    assetSummaries.push({
      path,
      filename: asset.filename,
      pageNumber: asset.pageNumber,
      mimeType: asset.mimeType,
      status: canInclude ? "used" : "skipped",
      ...(asset.warning ? { warning: asset.warning } : {}),
    });
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const path = buildOutputPath(jobId, now);
  const { error } = await supabase.storage.from("outputs").upload(path, buffer, {
    cacheControl: "3600",
    contentType: "application/zip",
    upsert: true,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  const { data } = supabase.storage.from("outputs").getPublicUrl(path);
  const metadata: JobMetadata = {
    topicCount: Object.keys(files).filter((filename) => filename.endsWith(".dita")).length,
    fileCount: Object.keys(files).length,
    usedAssetCount,
    skippedAssetCount: assetSummaries.length - usedAssetCount,
    validationPassed: validation.passed,
    validationIssueCount: validation.issueCount,
    ...(validation.agent2Skipped ? { agent2ValidationSkipped: true } : {}),
  };

  return {
    outputUrl: data.publicUrl,
    path,
    metadata,
    assets: assetSummaries,
  };
}

export function buildOutputPath(jobId: string, now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(".", "");
  return `${jobId}/${timestamp}-dita_output.zip`;
}

function ensureDitaExtension(filename: string): string {
  return filename.endsWith(".dita") || filename.endsWith(".ditamap")
    ? filename
    : `${filename}.dita`;
}

function getReferencedAssetPaths(files: Record<string, string>): Set<string> {
  const paths = new Set<string>();

  for (const content of Object.values(files)) {
    for (const match of content.matchAll(/<image\b[^>]*\bhref=["']([^"']+)["']/g)) {
      const path = normalizeAssetPath(match[1]);

      if (path.startsWith("images/")) {
        paths.add(path);
      }
    }
  }

  return paths;
}

function normalizeAssetPath(filename: string): string {
  const path = filename.replace(/\\/g, "/");
  const basename = path.split("/").pop() ?? filename;
  return path.startsWith("images/") ? `images/${basename}` : `images/${basename}`;
}

function stripJsonFence(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();
}

function normalizeValidationIssue(issue: unknown): ValidationIssue {
  const value = issue && typeof issue === "object" ? (issue as Record<string, unknown>) : {};
  const severity = value.severity;

  return {
    rule: typeof value.rule === "string" ? value.rule : "UNKNOWN",
    severity: severity === "error" || severity === "warning" || severity === "info" ? severity : "error",
    file: typeof value.file === "string" ? value.file : undefined,
    message: typeof value.message === "string" ? value.message : "Validation issue reported.",
    fixed: typeof value.fixed === "boolean" ? value.fixed : undefined,
  };
}

function normalizeFiles(files: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

async function addXmlWellFormedIssues(
  files: Record<string, string>,
  issues: ValidationIssue[],
): Promise<void> {
  const xml = await import("fast-xml-parser");
  const xmlModule = xml as typeof xml & { default?: typeof xml };
  const validator = xmlModule.XMLValidator ?? xmlModule.default?.XMLValidator;

  for (const [filename, content] of Object.entries(files)) {
    const validation = validator.validate(content);

    if (validation !== true) {
      const message =
        typeof validation === "object" && "err" in validation
          ? validation.err.msg
          : "XML is not well formed.";

      issues.push({
        rule: "XML_WELL_FORMED",
        severity: "error",
        file: filename,
        message,
        fixed: false,
      });
    }
  }
}

function addMapCompletenessIssues(
  files: Record<string, string>,
  filenames: Set<string>,
  issues: ValidationIssue[],
): void {
  const map = files["map.ditamap"];

  if (!map) {
    return;
  }

  const referenced = new Set([...map.matchAll(/<topicref\b[^>]*\bhref=["']([^"']+)["']/g)].map((m) => m[1]));

  for (const href of referenced) {
    if (!filenames.has(href)) {
      issues.push({
        rule: "TOPICREF_TARGETS",
        severity: "error",
        file: "map.ditamap",
        message: `Topicref href "${href}" does not point to a generated topic file.`,
        fixed: false,
      });
    }
  }

  for (const filename of filenames) {
    if (filename.endsWith(".dita") && !referenced.has(filename)) {
      issues.push({
        rule: "MAP_COMPLETENESS",
        severity: "warning",
        file: "map.ditamap",
        message: `Generated topic "${filename}" is not referenced by map.ditamap.`,
        fixed: false,
      });
    }
  }
}

function addImageIssues(
  files: Record<string, string>,
  availableAssets: Set<string>,
  issues: ValidationIssue[],
): void {
  for (const [filename, content] of Object.entries(files)) {
    for (const match of content.matchAll(/<image\b([^>]*)>/g)) {
      const attrs = match[1];
      const href = attrs.match(/\bhref=["']([^"']+)["']/)?.[1];
      const imageTagEnd = (match.index ?? 0) + match[0].length;
      const afterImageTag = content.slice(imageTagEnd, imageTagEnd + 300);
      const isSelfClosing = /\/\s*>$/.test(match[0]);

      if (href?.startsWith("images/") && availableAssets.size > 0 && !availableAssets.has(href)) {
        issues.push({
          rule: "IMAGE_REFERENCES",
          severity: "error",
          file: filename,
          message: `Image href "${href}" does not point to an available extracted asset.`,
          fixed: false,
        });
      }

      if (!isSelfClosing) {
        const closingImageIndex = afterImageTag.indexOf("</image>");
        const imageBody =
          closingImageIndex >= 0 ? afterImageTag.slice(0, closingImageIndex) : afterImageTag;

        if (!/<alt\b[^>]*>[\s\S]*?<\/alt>/.test(imageBody)) {
          issues.push({
            rule: "IMAGE_ALT_TEXT",
            severity: "warning",
            file: filename,
            message: href ? `Image "${href}" is missing alt text.` : "Image is missing alt text.",
            fixed: false,
          });
        }
      } else {
        issues.push({
          rule: "IMAGE_ALT_TEXT",
          severity: "warning",
          file: filename,
          message: href ? `Image "${href}" is missing alt text.` : "Image is missing alt text.",
          fixed: false,
        });
      }
    }
  }
}
