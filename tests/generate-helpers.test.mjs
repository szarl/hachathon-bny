import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function loadGenerateHelpers() {
  const sourcePath = new URL("../src/lib/generate.ts", import.meta.url);
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
  assert.match(message, /fixed map\.ditamap file/);
});
