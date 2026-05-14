import type { ClassifiedTopic } from "./classify";

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
  const files: Record<string, string> = {};
  const fileRegex = /%%FILE:([^%]+)%%\n([\s\S]*?)(?=%%FILE:|%%END%%|$)/g;
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(raw)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();

    if (filename && content) {
      files[filename] = content;
    }
  }

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

function ensureDitaExtension(filename: string): string {
  return filename.endsWith(".dita") || filename.endsWith(".ditamap")
    ? filename
    : `${filename}.dita`;
}
