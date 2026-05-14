import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function loadParseDelimited() {
  const sourcePath = new URL("../src/lib/parse-delimited-dita-output.ts", import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const encoded = Buffer.from(transpiled, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("parseDelimitedDitaOutput splits partial stream without map.ditamap", async () => {
  const { parseDelimitedDitaOutput } = await loadParseDelimited();

  const partial =
    "%%FILE:c_a.dita%%\n" +
    '<concept id="a"/>\n\n' +
    "%%FILE:t_b.dita%%\n" +
    '<task id="b"/><taskbody>';

  const files = parseDelimitedDitaOutput(partial);

  assert.match(files["c_a.dita"], /concept id="a"/);
  assert.match(files["t_b.dita"], /<task id="b"/);
});

test("parseDelimitedDitaOutput accepts CRLF after delimiter line", async () => {
  const { parseDelimitedDitaOutput } = await loadParseDelimited();

  const raw = "%%FILE:c_x.dita%%\r\n<concept />\r\n%%END%%";
  const files = parseDelimitedDitaOutput(raw);

  assert.match(files["c_x.dita"], /<concept\s\/>/);
});
