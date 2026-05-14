import "server-only";

import { getGeminiClient, geminiModels } from "@/lib/gemini";
import { withGeminiRetries } from "@/lib/gemini-retry";

/** Max characters of XML sent to the model (truncate tail with a note). */
const MAX_XML_CHARS = 140_000;

/** Gemini output cap — 8192 is too low for multi-topic HTML; larger models accept high values. */
const DEFAULT_HTML_PREVIEW_MAX_OUTPUT_TOKENS = 65536;

const SYSTEM = `You turn DITA XML topic files and a ditamap into ONE self-contained HTML5 document for preview in a browser.

The API enforces a maximum output length (you are told roughly how many output tokens remain available in each request). Responses that exceed it are CUT OFF MID-STREAM, which breaks validity. Avoid that entirely.

Rules:
- Output exactly one HTML file: start with <!DOCTYPE html>, include <meta charset="utf-8">, <title>, and a COMPACT <style> block (~30–50 lines max: typography, spacing, headings, lists, tables, code)—save tokens for body content so the full document completes.
- You MUST emit a complete, valid HTML5 document ending with "</html>" and close every opened tag (<style>...</style>, <main>...</main>, etc.). Do not stop mid-rule or mid-tag.
- Length discipline (non-negotiable): a shorter, FINISHED preview beats a longer, unfinished one. If the source set is large, stay well UNDER the quoted output budget — leave slack for closing tags.

  • Plan before you stream: skim the ditamap to estimate total topics; tighten prose early instead of shortening only at the end.
  • If you sense you may run long, SHORTEN proactively: tighter paragraphs; smaller tables or fewer rows summarized in plain text; less nesting; omit optional tangents—but always close open elements; never stop with half-open tags or an incomplete final section.
  • If you cannot fit everything, omit entire trailing topicref branches cleanly (prefer skipping whole late topics over cutting the last paragraph of the last topic). Add one brief editorial line in the footer if helpful, e.g. <p class="note">Later topics abbreviated for preview.</p>, then CLOSE.
  • Whenever uncertain, STOP adding new bodies of content early, round off the remainder, and finalize with "</html>" with margin to spare.

- Mirror document order and hierarchy from the ditamap (topicrefs). Use <main>, <article>, <section>, <h1>–<h3>, <p>, <ul>/<ol>, <table> where appropriate.
- Preserve wording; do not invent facts. Omit or strip <image>, <fig> image links, and any binary assets — do not use <img> and do not reference image files (MVP: text only). You may add a short parenthetical like "(Figure omitted in preview.)" where an image was.
- Do not use JavaScript. No external CSS or font URLs.
- Return ONLY the raw HTML document, no markdown code fences.`;

export function isAiHtmlPreviewEnabled(): boolean {
  const v = process.env.GEMINI_AI_HTML_PREVIEW_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no" || v === "off") {
    return false;
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return false;
  }
  return true;
}

function modelForHtmlPreview(): string {
  return process.env.GEMINI_HTML_PREVIEW_MODEL?.trim() || geminiModels.generate;
}

function maxOutputTokensForHtmlPreview(): number {
  const raw = process.env.GEMINI_HTML_PREVIEW_MAX_OUTPUT_TOKENS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    return Math.min(Math.max(Number.parseInt(raw, 10), 4096), 131072);
  }
  return DEFAULT_HTML_PREVIEW_MAX_OUTPUT_TOKENS;
}

/** True if trimmed output ends with `</html>` (truncated model output usually does not). */
export function appearsCompleteHtmlDocument(html: string): boolean {
  return /<\s*\/\s*html\s*>\s*$/i.test(html.trim());
}

function pickXmlFiles(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).filter(([name]) => name.endsWith(".dita") || name.endsWith(".ditamap")),
  );
}

function buildXmlPayload(files: Record<string, string>): string {
  const xml = pickXmlFiles(files);
  const parts = Object.entries(xml).map(([name, content]) => `<!-- file: ${name} -->\n${content}`);
  let payload = parts.join("\n\n");
  if (payload.length > MAX_XML_CHARS) {
    payload =
      payload.slice(0, MAX_XML_CHARS) +
      `\n\n<!-- truncated: original length exceeds ${MAX_XML_CHARS} chars -->`;
  }
  return payload;
}

export function stripOuterHtmlFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:html)?\s*/i, "");
    const end = t.lastIndexOf("```");
    if (end >= 0) {
      t = t.slice(0, end).trim();
    }
  }
  return t.trim();
}

/**
 * Gemini-generated HTML preview (single page, no embedded images).
 * Returns trimmed HTML starting with <!DOCTYPE html> or <html when possible.
 */
export async function generateAiHtmlPreview(
  files: Record<string, string>,
): Promise<{ ok: true; html: string } | { ok: false; message: string }> {
  if (!isAiHtmlPreviewEnabled()) {
    return { ok: false, message: "AI HTML preview is disabled or GEMINI_API_KEY is missing." };
  }

  const payload = buildXmlPayload(files);
  const maxOutTokens = maxOutputTokensForHtmlPreview();

  try {
    const ai = getGeminiClient();
    const budgetLine =
      `Hard output ceiling for this request: about ${maxOutTokens} tokens (model output tokens, not input). ` +
      `Treat roughly the last quarter of that budget as RESERVED for wrapping up — stop adding substantive content in time ` +
      `to close </main>, finish any trailing elements, emit </body></html>, and never exceed the ceiling.\n\n`;

    const response = await withGeminiRetries(() =>
      ai.models.generateContent({
        model: modelForHtmlPreview(),
        contents:
          budgetLine +
          "Convert the following DITA XML file set into the HTML5 preview described in your instructions.\n\n" +
          payload,
        config: {
          systemInstruction: SYSTEM,
          temperature: 0.2,
          maxOutputTokens: maxOutTokens,
        },
      }),
    );

    const text = stripOuterHtmlFence(response.text ?? "");

    if (!text || text.length < 50) {
      return { ok: false, message: "AI returned empty or trivial HTML preview." };
    }

    if (!/^<!DOCTYPE\s+html/i.test(text) && !/^<html[\s>\/]/i.test(text)) {
      return {
        ok: false,
        message: "AI output did not look like HTML (missing doctype/html root).",
      };
    }

    if (!appearsCompleteHtmlDocument(text)) {
      return {
        ok: false,
        message:
          "AI HTML preview was truncated (missing closing </html>). Set GEMINI_HTML_PREVIEW_MAX_OUTPUT_TOKENS higher, use a lighter model preset, or reduce topic count/size.",
      };
    }

    return { ok: true, html: text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `AI HTML preview failed: ${msg}` };
  }
}
