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

async function loadHttpJsonHelpers() {
  const helperPath = fileURLToPath(new URL("../src/lib/http-json.ts", import.meta.url));
  const src = await readFile(helperPath, "utf8");
  const js = ts.transpileModule(src, TS_OPTS).outputText;
  const encoded = Buffer.from(js, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("readJsonResponse parses valid JSON", async () => {
  const { readJsonResponse } = await loadHttpJsonHelpers();
  const res = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  assert.deepEqual(
    await readJsonResponse(res, { label: "Test API", url: "https://example.test/api" }),
    { ok: true },
  );
});

test("readJsonResponse reports HTML responses without leaking parser internals", async () => {
  const { readJsonResponse } = await loadHttpJsonHelpers();
  const res = new Response("<!doctype html><title>Not Found</title>", {
    status: 404,
    statusText: "Not Found",
    headers: { "content-type": "text/html; charset=utf-8" },
  });

  await assert.rejects(
    () => readJsonResponse(res, { label: "PDF extraction API", url: "https://example.test/api/extract" }),
    /PDF extraction API returned non-JSON \(404 Not Found, text\/html; charset=utf-8\).*Body starts with: <!doctype html>/,
  );
});
