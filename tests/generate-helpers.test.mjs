import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const TS_OPTS = {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: true,
  },
};

async function loadGenerateHelpers() {
  const require = createRequire(import.meta.url);
  const fastXmlParserUrl = pathToFileURL(require.resolve("fast-xml-parser")).href;
  const jszipUrl = pathToFileURL(require.resolve("jszip")).href;

  const parseDelimitedPath = fileURLToPath(new URL("../src/lib/parse-delimited-dita-output.ts", import.meta.url));
  const errorMessagePath = fileURLToPath(new URL("../src/lib/error-message.ts", import.meta.url));
  const generatePath = fileURLToPath(new URL("../src/lib/generate.ts", import.meta.url));
  const ditaHtml5Path = fileURLToPath(new URL("../src/lib/dita-html5.ts", import.meta.url));

  const [parseDelimitedSrc, errorMessageSrc, ditaHtml5Src, generateSrc] = await Promise.all([
    readFile(parseDelimitedPath, "utf8"),
    readFile(errorMessagePath, "utf8"),
    readFile(ditaHtml5Path, "utf8"),
    readFile(generatePath, "utf8"),
  ]);

  const parseDelimitedJs = ts
    .transpileModule(parseDelimitedSrc, TS_OPTS)
    .outputText.replace(/^export function parseDelimitedDitaOutput/m, "function parseDelimitedDitaOutput");

  const errorMessageJs = ts
    .transpileModule(errorMessageSrc, TS_OPTS)
    .outputText.replace(/^export function getErrorMessage/m, "function getErrorMessage");

  let ditaHtml5Js = ts.transpileModule(ditaHtml5Src, TS_OPTS).outputText;
  ditaHtml5Js = ditaHtml5Js.replace(/\nexport \{ ditaOtStrict \};\s*$/m, "");
  ditaHtml5Js = ditaHtml5Js.replace(/^export async function /gm, "async function ");
  ditaHtml5Js = ditaHtml5Js.replace(/^export function /gm, "function ");

  const generateJs = ts
    .transpileModule(generateSrc, TS_OPTS)
    .outputText
    .replace('import { generateAiHtmlPreview, isAiHtmlPreviewEnabled } from "@/lib/ai-html-preview";\r\n', "")
    .replace('import { generateAiHtmlPreview, isAiHtmlPreviewEnabled } from "@/lib/ai-html-preview";\n', "")
    .replace('import { ditaOtStrict, runDitaOtHtml5 } from "@/lib/dita-html5";\r\n', "")
    .replace('import { ditaOtStrict, runDitaOtHtml5 } from "@/lib/dita-html5";\n', "")
    .replace('import { getErrorMessage } from "@/lib/error-message";\r\n', "")
    .replace('import { getErrorMessage } from "@/lib/error-message";\n', "")
    .replace('import { parseDelimitedDitaOutput } from "./parse-delimited-dita-output";\r\n', "")
    .replace('import { parseDelimitedDitaOutput } from "./parse-delimited-dita-output";\n', "")
    .replace('import("fast-xml-parser")', `import("${fastXmlParserUrl}")`)
    .replace('import("jszip")', `import("${jszipUrl}")`);

  const aiHtmlPreviewStub = `
async function generateAiHtmlPreview() {
  return { ok: false, message: "stub" };
}
function isAiHtmlPreviewEnabled() {
  return false;
}
`;

  const combined = `${ditaHtml5Js}\n${aiHtmlPreviewStub}\n${parseDelimitedJs}\n${errorMessageJs}\n${generateJs}`;

  const encoded = Buffer.from(combined, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("parseFiles splits Agent 1 delimiter output into topic files and map.ditamap", async () => {
  const { parseFiles } = await loadGenerateHelpers();

  const files = parseFiles(`Some ignored preamble
%%FILE:c_intro.dita%%
<?xml version="1.0" encoding="UTF-8"?>
<concept id="concept-1111"></concept>

%%FILE:t_setup.dita%%
<?xml version="1.0" encoding="UTF-8"?>
<task id="task-2222"></task>
%%FILE:r_settings.dita%%
<?xml version="1.0" encoding="UTF-8"?>
<reference id="reference-3333"></reference>
%%FILE:map.ditamap%%
<?xml version="1.0" encoding="UTF-8"?>
<map id="ditamap-4444"></map>
%%END%%`);

  assert.deepEqual(Object.keys(files), [
    "c_intro.dita",
    "t_setup.dita",
    "r_settings.dita",
    "map.ditamap",
  ]);
  assert.match(files["map.ditamap"], /<map id="ditamap-4444">/);
});

test("parseFiles rejects output without usable file delimiters", async () => {
  const { parseFiles } = await loadGenerateHelpers();

  assert.throws(() => parseFiles("```xml\n<concept />\n```"), /No DITA files were found/);
});

test("buildGenerateUserMessage fixes BNY Platform and map.ditamap instructions", async () => {
  const { buildGenerateUserMessage } = await loadGenerateHelpers();

  const message = buildGenerateUserMessage({
    documentTitle: "Fund Operations",
    topics: [
      {
        type: "concept",
        title: "Manage 2a-7 Processing",
        suggestedFilename: "c_manage_2a7_processing",
        confidence: "high",
        splitReason: null,
        content: "Rule 2a-7 background.",
      },
    ],
  });

  assert.match(message, /Document title: Fund Operations/);
  assert.match(message, /Product name for keydef: BNY Platform/);
  assert.match(message, /Suggested filename: c_manage_2a7_processing\.dita/);
  assert.match(message, /Required topic filenames/);
  assert.match(message, /- c_manage_2a7_processing\.dita/);
  assert.match(message, /Emit exactly 1 topic file with these names/);
  assert.match(message, /<shortdesc/);
  assert.match(message, /For every Related images entry/);
  assert.match(message, /fixed map\.ditamap file/);
});

test("buildGenerateUserMessage prepends output budget line when maxOutputTokens set", async () => {
  const { buildGenerateUserMessage } = await loadGenerateHelpers();

  const message = buildGenerateUserMessage(
    {
      documentTitle: "Brief",
      topics: [
        {
          type: "concept",
          title: "Overview",
          suggestedFilename: "c_overview",
          confidence: "high",
          splitReason: null,
          content: "Short.",
        },
      ],
    },
    { maxOutputTokens: 12000 },
  );

  assert.match(message, /Hard output ceiling for this request: about 12000 model output tokens/);
  assert.match(message, /%%END%% on its own line/);
  assert.doesNotMatch(message, /drop entire trailing topic/i);
});

test("parseValidationResult accepts fenced Agent 2 JSON and preserves repaired files", async () => {
  const { parseValidationResult } = await loadGenerateHelpers();

  const result = parseValidationResult(`\`\`\`json
{
  "passed": true,
  "issueCount": 1,
  "issues": [
    {
      "rule": "XML_WELL_FORMED",
      "severity": "warning",
      "file": "c_intro.dita",
      "message": "Fixed entity escaping.",
      "fixed": true
    }
  ],
  "files": {
    "c_intro.dita": "<concept id=\\"concept-1111\\"/>",
    "map.ditamap": "<map><topicref href=\\"c_intro.dita\\"/></map>"
  }
}
\`\`\``);

  assert.equal(result.passed, true);
  assert.equal(result.issueCount, 1);
  assert.equal(result.issues[0].rule, "XML_WELL_FORMED");
  assert.equal(result.files["c_intro.dita"], '<concept id="concept-1111"/>');
});

test("buildValidationUserMessage includes deterministic issues and all file contents", async () => {
  const { buildValidationUserMessage } = await loadGenerateHelpers();

  const message = buildValidationUserMessage({
    files: {
      "c_intro.dita": "<concept/>",
      "map.ditamap": "<map/>",
    },
    deterministicIssues: [
      {
        rule: "MAP_COMPLETENESS",
        severity: "error",
        file: "map.ditamap",
        message: "Missing topicref for c_intro.dita.",
        fixed: false,
      },
    ],
  });

  assert.match(message, /Deterministic issues to repair/);
  assert.match(message, /MAP_COMPLETENESS/);
  assert.match(message, /%%FILE:c_intro\.dita%%/);
  assert.match(message, /%%FILE:map\.ditamap%%/);
});

test("buildValidationUserMessage prepends JSON budget preamble when maxOutputTokens set", async () => {
  const { buildValidationUserMessage } = await loadGenerateHelpers();

  const message = buildValidationUserMessage(
    {
      files: { "c_intro.dita": "<concept/>", "map.ditamap": "<map/>" },
      deterministicIssues: [],
    },
    { maxOutputTokens: 8000 },
  );

  assert.match(message, /about 8000 model output tokens/);
  assert.match(message, /Return exactly one JSON object that parses\./);
});

test("runDeterministicChecks reports map and image validation issues", async () => {
  const { runDeterministicChecks } = await loadGenerateHelpers();

  const issues = await runDeterministicChecks({
    "c_intro.dita":
      '<concept id="concept-1111"><title>Intro</title><conbody><fig><image href="images/missing.png"/></fig></conbody></concept>',
    "map.ditamap": '<map><topicref href="missing.dita"/></map>',
  });

  assert.ok(issues.some((issue) => issue.rule === "TOPICREF_TARGETS"));
  assert.ok(issues.some((issue) => issue.rule === "MAP_COMPLETENESS"));
  assert.ok(issues.some((issue) => issue.rule === "IMAGE_ALT_TEXT"));
});

test("runDeterministicChecks accepts non-self-closing images with alt text", async () => {
  const { runDeterministicChecks } = await loadGenerateHelpers();

  const issues = await runDeterministicChecks(
    {
      "c_intro.dita":
        '<concept id="concept-1111"><title>Intro</title><conbody><fig><image href="images/chart.png"><alt>Chart of balances.</alt></image></fig></conbody></concept>',
      "map.ditamap": '<map><topicref href="c_intro.dita"/></map>',
    },
    ["images/chart.png"],
  );

  assert.equal(issues.some((issue) => issue.rule === "IMAGE_ALT_TEXT"), false);
  assert.equal(issues.some((issue) => issue.rule === "IMAGE_REFERENCES"), false);
});

test("runDeterministicChecks reports missing required topic files", async () => {
  const { runDeterministicChecks } = await loadGenerateHelpers();

  const issues = await runDeterministicChecks(
    {
      "c_intro.dita": "<concept/>",
      "map.ditamap": '<map><topicref href="c_intro.dita"/></map>',
    },
    [],
    ["c_intro.dita", "t_missing.dita", "map.ditamap"],
  );

  assert.ok(issues.some((issue) => issue.rule === "REQUIRED_FILES" && issue.file === "t_missing.dita"));
});

test("preserveRequiredFiles restores files dropped by validation", async () => {
  const { preserveRequiredFiles } = await loadGenerateHelpers();

  const files = preserveRequiredFiles(
    { "c_intro.dita": "<concept/>", "map.ditamap": "<map/>" },
    { "c_intro.dita": "<concept/>", "t_steps.dita": "<task/>", "map.ditamap": "<map/>" },
    ["c_intro.dita", "t_steps.dita", "map.ditamap"],
  );

  assert.equal(files["t_steps.dita"], "<task/>");
});

test("ensureRelatedImageFigures inserts missing referenced figures for topic images", async () => {
  const { ensureRelatedImageFigures, runDeterministicChecks } = await loadGenerateHelpers();

  const files = ensureRelatedImageFigures(
    {
      "c_set_up_entities_for_caps.dita":
        '<concept id="concept-1111"><title>Set Up Entities for Caps and Floors</title><shortdesc class="- topic/shortdesc ">About netting.</shortdesc><conbody><p>Body.</p></conbody></concept>',
      "map.ditamap": '<map><topicref href="c_set_up_entities_for_caps.dita"/></map>',
    },
    [
      {
        type: "concept",
        title: "Set Up Entities for Caps and Floors",
        suggestedFilename: "c_set_up_entities_for_caps",
        confidence: "high",
        splitReason: null,
        content: "About netting.",
        sourcePages: [6],
        relatedImages: ["page_06_image_01.png"],
      },
    ],
    [
      {
        filename: "page_06_image_01.png",
        pageNumber: 6,
        mimeType: "image/png",
        caption: "Set Up Entities for Caps and Floors",
        dataBase64: Buffer.from("image").toString("base64"),
      },
    ],
  );

  assert.match(files["c_set_up_entities_for_caps.dita"], /<fig class="- topic\/fig ">/);
  assert.match(files["c_set_up_entities_for_caps.dita"], /href="images\/page_06_image_01\.png"/);
  assert.match(files["c_set_up_entities_for_caps.dita"], /<alt class="- topic\/alt ">Set Up Entities for Caps and Floors<\/alt>/);

  const issues = await runDeterministicChecks(files, ["images/page_06_image_01.png"]);
  assert.equal(issues.some((issue) => issue.rule === "IMAGE_REFERENCES"), false);
  assert.equal(issues.some((issue) => issue.rule === "IMAGE_ALT_TEXT"), false);
});

test("pickXmlTextFilesForSse keeps only .dita and .ditamap entries for Monaco SSE", async () => {
  const { pickXmlTextFilesForSse } = await loadGenerateHelpers();

  const sse = pickXmlTextFilesForSse({
    "c_intro.dita": "<concept/>",
    "map.ditamap": "<map/>",
    "_manifest.json": "{}",
    notes: "not xml",
  });

  assert.deepEqual(Object.keys(sse), ["c_intro.dita", "map.ditamap"]);
});

test("uploadFilesToStorage throws when Supabase upload returns an error", async () => {
  const { uploadFilesToStorage } = await loadGenerateHelpers();
  const supabase = {
    storage: {
      from() {
        return {
          async upload() {
            return { error: new Error("storage quota") };
          },
          getPublicUrl() {
            return { data: { publicUrl: "" } };
          },
        };
      },
    },
  };

  await assert.rejects(
    () =>
      uploadFilesToStorage(
        "job-123",
        { "c_intro.dita": "<concept/>", "map.ditamap": "<map/>" },
        [],
        { passed: true, issueCount: 0 },
        new Date(),
        supabase,
      ),
    /storage quota/,
  );
});

test("uploadFilesToStorage zips XML and only referenced image assets, then returns metadata", async () => {
  const require = createRequire(import.meta.url);
  const JSZip = require("jszip");
  const { uploadFilesToStorage } = await loadGenerateHelpers();
  const uploads = [];
  const calls = [];
  const supabase = {
    storage: {
      from(bucket) {
        return {
          async upload(path, body, options) {
            uploads.push({ bucket, path, body, options });
            return { error: null };
          },
          getPublicUrl(path) {
            calls.push(["getPublicUrl", bucket, path]);
            return {
              data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` },
            };
          },
        };
      },
    },
  };

  const result = await uploadFilesToStorage(
    "job-123",
    {
      "c_intro.dita":
        '<concept><fig><image href="images/page_03_image_01.png"><alt>Chart</alt></image></fig></concept>',
      "map.ditamap": '<map><topicref href="c_intro.dita"/></map>',
    },
    [
      {
        filename: "page_03_image_01.png",
        pageNumber: 3,
        mimeType: "image/png",
        dataBase64: Buffer.from("used image").toString("base64"),
      },
      {
        filename: "page_03_image_02.png",
        pageNumber: 3,
        mimeType: "image/png",
        dataBase64: Buffer.from("unused image").toString("base64"),
      },
    ],
    { passed: true, issueCount: 0 },
    new Date("2026-05-14T10:20:30.000Z"),
    supabase,
  );

  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].bucket, "outputs");
  assert.equal(uploads[0].path, "job-123/20260514T102030000Z-dita_output.zip");
  assert.equal(uploads[0].options.contentType, "application/zip");
  assert.equal(uploads[0].options.upsert, true);
  assert.equal(result.outputUrl, "https://example.supabase.co/storage/v1/object/public/outputs/job-123/20260514T102030000Z-dita_output.zip");
  assert.deepEqual(result.metadata, {
    topicCount: 1,
    fileCount: 2,
    usedAssetCount: 1,
    skippedAssetCount: 1,
    validationPassed: true,
    validationIssueCount: 0,
    htmlGenerationStatus: "skipped",
    htmlGenerationMessage: "DITA_OT_ENABLED is not set.",
  });

  const zip = await JSZip.loadAsync(uploads[0].body);
  assert.ok(zip.file("c_intro.dita"));
  assert.ok(zip.file("map.ditamap"));
  assert.ok(zip.file("images/page_03_image_01.png"));
  assert.equal(zip.file("images/page_03_image_02.png"), null);
});
