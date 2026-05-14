# DITA Converter Architecture Decisions

Last updated: 2026-05-14

This document records the shared design decisions that refine the PRD pack. The split PRDs remain the delivery checklist, but implementation should follow these decisions when a PRD conflicts with the current repo, `AGENTS.md`, or the prompt context files.

## Source of truth

- Use the current repo and `AGENTS.md` as the operational source of truth.
- Implement App Router files under `src/app`, not `/app`.
- Use `@google/genai`, not `@google/generative-ai`.
- Use `docs/prompts-context/api_classify_prompt.md` and `docs/prompts-context/api_generate_prompt.md` as the canonical human-authored prompt source. Runtime code should copy the needed prompt constants into TypeScript modules instead of reading Markdown files from `docs`.

## Product scope

- The first build is unauthenticated and demo-oriented.
- One conversion job handles exactly one PDF.
- Default product name is fixed to `BNY Platform`.
- Upload limit is PDF-only, 50 MB maximum, enforced in the browser and server route.
- OCR is an explicit optional fallback stage, but the first implementation should complete the text and embedded-image pipeline before enabling OCR.

## Backend-owned pipeline

- The browser should not orchestrate extract, classify, and generate calls.
- The browser uploads the PDF to `POST /api/jobs`; the server creates a job row, uploads the PDF to Supabase Storage, stores `jobs.pdf_url`, and returns `jobId`.
- The browser then starts one SSE request to `POST /api/generate` with `{ jobId, documentTitle }`.
- **Batch Jobs** (multi-PDF): `POST /api/batches` runs only when the user clicks **Upload and convert batch** (not on page load). That creates one `public.batches` row for the run; each PDF uploads with `batch_id` so `jobs.batch_id` (FK) and `metadata.batch_id` are set. Conversions run as **multiple parallel** `POST /api/batch/run` requests (one `jobId` each, client-side concurrency cap in `batch-config.ts`). The route uses shared `conversion-pipeline.ts` with non-streaming Agent 1 and JSON responses. Batch history reads `batches` plus job rows (expand uses `batch_id` or legacy `metadata.batch_id`).
- `/api/generate` owns the full backend pipeline:
  1. Look up the job and `pdf_url`.
  2. Fetch the uploaded PDF.
  3. Send it to the deployed Python extractor.
  4. Classify extracted pages into DITA topics.
  5. Stream Agent 1 DITA generation tokens to the browser.
  6. Parse Agent 1 output into files after streaming completes.
  7. Run deterministic checks only after Agent 1 is complete.
  8. Run Agent 2 validation/repair.
  9. Package final XML plus referenced image assets into a ZIP.
  10. Upload the ZIP to Supabase Storage and mark the job done.

## Extractor boundary

- PDF parsing stays in the deployed Python/Vercel extractor function.
- Local development can keep the existing rewrite from `/api/extract` to `http://127.0.0.1:8001/api/extract`.
- Production should use `EXTRACT_API_URL` or an equivalent Vercel routing setup.
- The extractor owns text, font-size metadata, image detection, and image extraction.
- **Rich layout (2026-05-14):** The Python extractor uses **pdfplumber** for text, tables, and embedded-image rasterization, and **PyMuPDF (`pymupdf`)** on the same file path for the same page index. Both libraries must agree on page count; a mismatch is a hard error. PyMuPDF supplies **hyperlink metadata** and **short text snippets near image bounding boxes** (stored as `caption` on each image object). We intentionally do **not** inject `[URI: …]` markers into `text` with `re.sub`; hyperlinks are returned as a **structured array** so classifiers and generators can reason about links when overlay text and flow text disagree.

## Extraction response shape

The extractor should return:

```ts
type ExtractedHyperlink = {
  anchorText: string;
  uri?: string;
  targetPage?: number; // 1-based internal destination when kind is in-document
};

type ExtractedPage = {
  pageNumber: number;
  text: string;
  fontSizes: number[];
  source?: "pdfplumber" | "ocr";
  /** pdfplumber extract_tables — list of tables, each table is rows of string cells */
  tables?: string[][][];
  hyperlinks?: ExtractedHyperlink[];
  images?: ExtractedImage[];
};

type ExtractedImage = {
  filename: string;
  pageNumber: number;
  caption?: string;
  width?: number;
  height?: number;
  dataBase64?: string;
  /** Extractor emits PNG only (normalized width and size). */
  mimeType: "image/png";
  skipped?: boolean;
  warning?: string;
};
```

- Omit `tables` and `hyperlinks` when empty to keep payloads small.
- Table and link extraction apply **server-side caps** (tables per page, rows/cols, links per page, URI and anchor string lengths) to control token load downstream.
- Image filenames stay **`page_XX_image_YY.ext`** so `collectExtractedAssets`, deterministic checks, and Agent 1 `href` rules stay aligned.
- Base64 image payloads must be **PNG** only: resized so the raster width is at most **1000 px** (aspect ratio preserved), then compressed to **at most 200 KB** per image (further downscale if needed). A **10 MB** total cap per PDF still applies across all images. Images that cannot be normalized within those limits are reported as skipped asset warnings.

## Classification input from extraction

- `buildUserMessage` in `src/lib/classify.ts` includes, for each content page (still **`pageNumber >= 3`** only): font sizes, optional **tables as JSON** (truncated), **hyperlinks** (URIs truncated for the prompt), **images with optional caption/context**, then the page `text`. This encodes the same intent as the reference Streamlit normalizer while keeping the **classify → generate** pipeline in TypeScript.

## OCR fallback

- If extracted text is too sparse, the architecture should support an `ocr` stage.
- OCR should use page images with Gemini as a best-effort fallback, not a guaranteed first-version feature.
- OCR output should normalize back into the same `ExtractedPage` shape.

## Classification

- Classifier **inputs** are assembled in `buildUserMessage`; see **Classification input from extraction** (fonts, truncated tables JSON, hyperlinks, image captions, then plain text for pages with `pageNumber >= 3`). The user turn also states that each JSON topic becomes one `.dita` file and subsection headings must not spawn extra topics.
- Prefer **chapter-level** topics: subsection titles (e.g. `2.1`, `2.2`) stay inside the parent topic `content`; split only for mixed concept/task/reference boundaries per the classify prompt.
- The classifier output should include the PRD fields plus source and image hints:

```ts
type ClassifiedTopic = {
  type: "concept" | "task" | "reference";
  title: string;
  suggestedFilename: string;
  confidence: "high" | "medium" | "low";
  splitReason: string | null;
  content: string;
  sourcePages?: number[];
  relatedImages?: string[];
};
```

- The backend should repair fenced/broken JSON once, normalize filenames, filter invalid topics, and fail clearly if no usable topics remain.

## Gemini models

Use split model environment variables:

```env
GEMINI_CLASSIFY_MODEL=gemini-2.0-flash
GEMINI_GENERATE_MODEL=gemini-2.0-flash
GEMINI_VALIDATE_MODEL=gemini-2.0-flash
```

Each value should default to `gemini-2.0-flash` if unset.

## Generation format

Agent 1 streams delimiter-based plain text:

```text
%%FILE:c_example_concept.dita%%
<?xml version="1.0" encoding="UTF-8"?>
...

%%FILE:map.ditamap%%
<?xml version="1.0" encoding="UTF-8"?>
...
%%END%%
```

- Do not stream JSON or markdown fences from Agent 1.
- Use `map.ditamap` as the fixed map filename.
- Topic filenames should be safe lowercase snake case with `c_`, `t_`, or `r_` prefixes.
- If Agent 1 output cannot be parsed, do one non-streamed formatting repair retry before failing.

## Validation

- Do not run deterministic XML checks while Agent 1 is still streaming; partial tags are expected.
- After `agent1_done`, parse files and run lightweight deterministic checks:
  - Expected file count and `map.ditamap` exists.
  - Every topicref href points to a generated topic file.
  - XML is basically well formed using `fast-xml-parser`.
  - Every `<image href="images/...">` points to an available extracted asset.
  - Every image has alt text.
- Agent 2 remains the main validation and repair step. It receives files plus deterministic issues and returns final repaired files and a validation report. Its system prompt also instructs **editorial** passes on returned XML: fix obvious spelling and grammar in narrative text, prefer **active voice** over weak passive where clear, replace Latin abbreviations (i.e., e.g., etc., viz., et al.) with plain English, and skip changes inside `codeblock` / `codeph` / paths that must stay verbatim. Topic files must include **`<shortdesc>`** after `<title>` for link previews and search.

## Images and DITA assets

- Extracted image assets should live under `images/` inside the final ZIP.
- Generated topics should reference relevant images directly with relative `href`, not map-level media keyrefs:

```xml
<fig>
  <title>Caption</title>
  <image href="images/page_03_image_01.png" placement="break">
    <alt>Accessible description</alt>
  </image>
</fig>
```

- Only relevant images should be referenced in topics.
- Only images referenced by final validated XML should be included in the output ZIP.
- The `.ditamap` should reference topic files and the `product-name` keydef, not every image asset.

## SSE contract

`POST /api/generate` should send these events:

```ts
{ type: "stage", stage: "extracting", label: "Extracting PDF" }
{ type: "stage", stage: "ocr", label: "Running OCR fallback" }
{ type: "stage", stage: "classifying", label: "Classifying topics" }
{ type: "topics", topics: ClassifiedTopic[] }
{ type: "stage", stage: "generating", label: "Agent 1 - generating DITA" }
{ type: "token", text: string }
{ type: "agent1_done", fileCount: number }
{ type: "stage", stage: "validating", label: "Agent 2 - validating XML" }
{ type: "validation", passed: boolean, issueCount: number, issues: ValidationIssue[] }
{ type: "stage", stage: "saving", label: "Saving ZIP" }
{ type: "files", files: Record<string, string> }
{ type: "assets", assets: AssetSummary[] }
{ type: "done", outputUrl: string, metadata: JobMetadata }
{ type: "error", error: string }
```

The `files` event should include XML text files only, not base64 assets.

## Supabase

- All writes go through server routes that use `SUPABASE_SERVICE_ROLE_KEY`.
- Public client access is read-only for job history and realtime.
- Buckets:
  - `uploads`: public, 50 MB
  - `outputs`: public
- Keep original display filename in `jobs.filename`.
- Sanitize storage filenames and prefix them with a timestamp.
- Use unique storage paths:
  - `uploads/{jobId}/{timestamp}-{safeFilename}`
  - `outputs/{jobId}/{timestamp}-dita_output.zip`
- Add a flexible `metadata jsonb` column to `jobs` for counts and validation summary.

## UI behavior

- Upload/job creation is a pre-pipeline button state, not one of the five primary stages.
- Keep the primary progress indicator at five stages:
  1. Extracting PDF
  2. Classifying topics
  3. Agent 1 generating
  4. Agent 2 validating
  5. Complete
- Show OCR, asset packaging, and saving as sub-status text.
- Monaco shows one live raw stream during Agent 1 generation, then switches to final validated tabs after the `files` event.
- Final tabs show XML only.
- Show a subtle final summary such as `4 XML files - 2 images - ZIP ready`.
- Job history should show the most recent 10 or 20 jobs with filename, created time, status, and download action. It remains read-only.
