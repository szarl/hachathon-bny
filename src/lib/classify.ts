export type TopicType = "concept" | "task" | "reference";
export type TopicConfidence = "high" | "medium" | "low";

/** PDF link extracted via PyMuPDF (structured; avoids fragile text injection). */
export type ExtractedHyperlink = {
  anchorText: string;
  uri?: string;
  targetPage?: number;
};

export type ExtractedPage = {
  pageNumber: number;
  text: string;
  fontSizes?: number[];
  source?: "pdfplumber" | "ocr";
  /** pdfplumber `extract_tables()` — list of row arrays, cells as strings. */
  tables?: string[][][];
  hyperlinks?: ExtractedHyperlink[];
  images?: Array<{
    filename: string;
    pageNumber: number;
    caption?: string;
    width?: number;
    height?: number;
    dataBase64?: string;
  mimeType: "image/png";
    skipped?: boolean;
    warning?: string;
  }>;
};

export type ClassifiedTopic = {
  type: TopicType;
  title: string;
  suggestedFilename: string;
  confidence: TopicConfidence;
  splitReason: string | null;
  content: string;
  sourcePages?: number[];
  relatedImages?: string[];
};

const TOPIC_TYPES = new Set<TopicType>(["concept", "task", "reference"]);
const CONFIDENCE_VALUES = new Set<TopicConfidence>(["high", "medium", "low"]);
const TASK_MARKERS = ["PREREQ:", "CONTEXT:", "STEPS:", "RESULT:"];

const MAX_TABLE_JSON_CHARS = 6000;
const MAX_URI_IN_CLASSIFY = 120;
const MAX_HYPERLINK_LINES = 40;
const MAX_IMAGE_CAPTION_CHARS = 220;

function truncateUri(uri: string): string {
  if (uri.length <= MAX_URI_IN_CLASSIFY) return uri;
  return `${uri.slice(0, MAX_URI_IN_CLASSIFY)}…`;
}

function formatTablesBlock(tables: string[][][] | undefined): string {
  if (!tables?.length) return "";
  try {
    const raw = JSON.stringify(tables);
    const body =
      raw.length > MAX_TABLE_JSON_CHARS
        ? `${raw.slice(0, MAX_TABLE_JSON_CHARS)}\n... (tables JSON truncated)`
        : raw;
    return `Tables (JSON):\n${body}\n`;
  } catch {
    return "";
  }
}

function formatHyperlinksBlock(links: ExtractedHyperlink[] | undefined): string {
  if (!links?.length) return "";
  const lines = links.slice(0, MAX_HYPERLINK_LINES).map((link) => {
    const anchor = link.anchorText || "(no anchor text)";
    if (link.uri) {
      return `- "${anchor}" -> ${truncateUri(link.uri)}`;
    }
    if (link.targetPage != null) {
      return `- "${anchor}" -> internal page ${link.targetPage}`;
    }
    return `- "${anchor}"`;
  });
  return `Hyperlinks:\n${lines.join("\n")}\n`;
}

function formatImagesBlock(
  images: NonNullable<ExtractedPage["images"]> | undefined,
): string {
  if (!images?.length) return "";
  const lines = images.map((image) => {
    const cap =
      image.caption && image.caption.trim()
        ? ` — context: ${image.caption.trim().slice(0, MAX_IMAGE_CAPTION_CHARS)}`
        : "";
    const skip = image.skipped ? " (skipped)" : "";
    return `- ${image.filename}${cap}${skip}`;
  });
  return `Images:\n${lines.join("\n")}\n`;
}

export function buildUserMessage(pages: ExtractedPage[]): string {
  const pageBlocks = pages
    .filter((page) => page.pageNumber >= 3)
    .map((page) => {
      const fontSizes = page.fontSizes?.length
        ? `Font sizes: ${page.fontSizes.join(", ")}\n`
        : "";
      const tablesBlock = formatTablesBlock(page.tables);
      const linksBlock = formatHyperlinksBlock(page.hyperlinks);
      const imagesBlock = formatImagesBlock(page.images);

      return `--- PAGE ${page.pageNumber} ---\n${fontSizes}${tablesBlock}${linksBlock}${imagesBlock}${page.text}`;
    })
    .join("\n\n");

  return (
    "Classify the following extracted PDF text into DITA topics.\n\n" +
    "Apply all cleaning, normalisation, and splitting rules from the system prompt.\n\n" +
    "Hard rule: each JSON object becomes one .dita file. Do not emit one topic per subsection " +
    "(e.g. headings like 2.1, 2.2, or short in-chapter titles); keep those inside the parent chapter topic's content.\n\n" +
    "When useful, include sourcePages and relatedImages fields using the supplied page numbers and image filenames.\n\n" +
    pageBlocks
  );
}

export function stripJsonFences(rawText: string): string {
  return rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseClassifiedTopics(rawText: string): ClassifiedTopic[] {
  const parsed = JSON.parse(stripJsonFences(rawText)) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini classification response must be a JSON array.");
  }

  return normalizeClassifiedTopics(parsed);
}

export function normalizeClassifiedTopics(topics: unknown[]): ClassifiedTopic[] {
  return topics.flatMap((topic) => {
    if (!isTopicRecord(topic)) {
      return [];
    }

    const type = topic.type;
    const confidence = topic.confidence;
    const title = cleanTitle(topic.title);
    const content = topic.content.trim();

    if (!TOPIC_TYPES.has(type) || !CONFIDENCE_VALUES.has(confidence)) {
      return [];
    }

    if (!title || !content || !taskHasRequiredMarkers(type, content)) {
      return [];
    }

    const sourcePages = numberArray(topic.sourcePages);
    const relatedImages = stringArray(topic.relatedImages);

    return [
      {
        type,
        title,
        suggestedFilename: normalizeSuggestedFilename(type, title),
        confidence,
        splitReason:
          typeof topic.splitReason === "string" && topic.splitReason.trim()
            ? topic.splitReason.trim()
            : null,
        content,
        ...(sourcePages ? { sourcePages } : {}),
        ...(relatedImages ? { relatedImages } : {}),
      },
    ];
  });
}

export function normalizeSuggestedFilename(type: TopicType, title: string): string {
  const prefix = { concept: "c", task: "t", reference: "r" }[type];
  const slug = cleanTitle(title)
    .toLowerCase()
    .replace(/2a-?7/g, "2a7")
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .split("_")
    .filter(Boolean)
    .slice(0, 5)
    .join("_");

  return `${prefix}_${slug || "topic"}`;
}

function cleanTitle(title: string): string {
  return title.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, "").trim();
}

function taskHasRequiredMarkers(type: TopicType, content: string): boolean {
  return type !== "task" || TASK_MARKERS.every((marker) => content.includes(marker));
}

function isTopicRecord(topic: unknown): topic is {
  type: TopicType;
  title: string;
  suggestedFilename?: string;
  confidence: TopicConfidence;
  splitReason?: unknown;
  content: string;
  sourcePages?: unknown;
  relatedImages?: unknown;
} {
  return (
    typeof topic === "object" &&
    topic !== null &&
    "type" in topic &&
    "title" in topic &&
    "confidence" in topic &&
    "content" in topic &&
    typeof topic.type === "string" &&
    typeof topic.title === "string" &&
    typeof topic.confidence === "string" &&
    typeof topic.content === "string"
  );
}

function numberArray(value: unknown): number[] | null {
  if (!Array.isArray(value) || !value.every((item) => Number.isInteger(item))) {
    return null;
  }

  return value;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }

  return value.map((item) => item.trim()).filter(Boolean);
}
