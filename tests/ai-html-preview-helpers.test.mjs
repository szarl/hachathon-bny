import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const TS_OPTS = {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: true,
  },
};

async function loadAiHtmlPreviewHelpers() {
  const path = fileURLToPath(new URL("../src/lib/ai-html-preview.ts", import.meta.url));
  const raw = await readFile(path, "utf8");
  let js = ts.transpileModule(raw, TS_OPTS).outputText;
  js = js.replace(/^import .*;\r?\n/gm, "");
  js = js.replace(/^export async function /gm, "async function ");
  js = js.replace(/^export function /gm, "function ");
  js += "\nexport { appearsCompleteHtmlDocument, stripOuterHtmlFence };";
  const encoded = Buffer.from(js, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("appearsCompleteHtmlDocument true only when </html> at end", async () => {
  const { appearsCompleteHtmlDocument } = await loadAiHtmlPreviewHelpers();

  assert.equal(appearsCompleteHtmlDocument("<!DOCTYPE html><html><body></body></html>"), true);
  assert.equal(appearsCompleteHtmlDocument("<!DOCTYPE html><html><body></body></html>\n"), true);
  assert.equal(appearsCompleteHtmlDocument("<html><head><style>p{}"), false);
  assert.equal(
    appearsCompleteHtmlDocument("</html><!-- note: trick middle --><p>x</p>"),
    false,
  );
});
