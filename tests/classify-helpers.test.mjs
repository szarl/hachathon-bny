import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function loadClassifyHelpers() {
  const sourcePath = new URL("../src/lib/classify.ts", import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  }).outputText;

  const encoded = Buffer.from(transpiled, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("buildUserMessage skips cover and TOC pages while preserving content pages", async () => {
  const { buildUserMessage } = await loadClassifyHelpers();

  const message = buildUserMessage([
    { pageNumber: 1, text: "Cover", fontSizes: [30] },
    { pageNumber: 2, text: "Table of Contents", fontSizes: [18] },
    { pageNumber: 3, text: "Set Up Master Fund", fontSizes: [16, 10] },
  ]);

  assert.doesNotMatch(message, /Cover/);
  assert.doesNotMatch(message, /Table of Contents/);
  assert.match(message, /--- PAGE 3 ---\nFont sizes: 16, 10\nSet Up Master Fund/);
});

test("buildUserMessage includes tables hyperlinks and image captions on content pages", async () => {
  const { buildUserMessage } = await loadClassifyHelpers();

  const message = buildUserMessage([
    {
      pageNumber: 3,
      text: "Body paragraph.",
      tables: [[["A", "B"], ["1", "2"]]],
      hyperlinks: [
        { anchorText: "See docs", uri: "https://example.com/very-long-path" + "/x".repeat(200) },
        { anchorText: "Jump", targetPage: 10 },
      ],
      images: [
        {
          filename: "page_03_image_01.png",
          pageNumber: 3,
          mimeType: "image/png",
          caption: "Figure 1: Widget overview text",
        },
      ],
    },
  ]);

  assert.match(message, /Tables \(JSON\):/);
  assert.match(message, /\[\[\["A","B"\]/);
  assert.match(message, /Hyperlinks:/);
  assert.match(message, /"See docs"/);
  assert.match(message, /internal page 10/);
  assert.match(message, /Images:/);
  assert.match(message, /page_03_image_01\.png/);
  assert.match(message, /Figure 1: Widget overview/);
  assert.match(message, /Body paragraph\./);
});

test("parseClassifiedTopics strips markdown fences and normalizes usable topics", async () => {
  const { parseClassifiedTopics } = await loadClassifyHelpers();

  const topics = parseClassifiedTopics(`\`\`\`json
[
  {
    "type": "task",
    "title": "3. Set Up Master Fund for 2a-7 Processing",
    "suggestedFilename": "Wrong Name!!.dita",
    "confidence": "high",
    "splitReason": null,
    "content": "PREREQ: Prep\\n\\nCONTEXT: About\\n\\nSTEPS:\\n1. Do it.\\n\\nRESULT: Done.",
    "sourcePages": [3, 4],
    "relatedImages": ["page_03_image_01.png"]
  },
  {
    "type": "other",
    "title": "Bad",
    "suggestedFilename": "bad",
    "confidence": "high",
    "splitReason": null,
    "content": "Bad"
  }
]
\`\`\``);

  assert.equal(topics.length, 1);
  assert.equal(topics[0].type, "task");
  assert.equal(topics[0].title, "Set Up Master Fund for 2a-7 Processing");
  assert.equal(topics[0].suggestedFilename, "t_set_up_master_fund_for");
  assert.deepEqual(topics[0].sourcePages, [3, 4]);
  assert.deepEqual(topics[0].relatedImages, ["page_03_image_01.png"]);
});

test("parseClassifiedTopics drops task topics missing required structure markers", async () => {
  const { parseClassifiedTopics } = await loadClassifyHelpers();

  const topics = parseClassifiedTopics(JSON.stringify([
    {
      type: "task",
      title: "Configure Fund",
      suggestedFilename: "t_configure_fund",
      confidence: "medium",
      splitReason: null,
      content: "STEPS:\n1. Configure the fund.",
    },
    {
      type: "concept",
      title: "Manage 2a-7 Processing",
      suggestedFilename: "c_manage_2a7_processing",
      confidence: "high",
      splitReason: null,
      content: "Rule 2a-7 background.",
    },
  ]));

  assert.equal(topics.length, 1);
  assert.equal(topics[0].type, "concept");
});
