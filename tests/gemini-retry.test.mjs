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

async function loadGeminiRetryHelpers() {
  const retryPath = fileURLToPath(new URL("../src/lib/gemini-retry.ts", import.meta.url));
  const errorMessagePath = fileURLToPath(new URL("../src/lib/error-message.ts", import.meta.url));

  const [retrySource, errorMessageSource] = await Promise.all([
    readFile(retryPath, "utf8"),
    readFile(errorMessagePath, "utf8"),
  ]);

  const errorMessageJs = ts
    .transpileModule(errorMessageSource, TS_OPTS)
    .outputText.replace(/^export function getErrorMessage/m, "function getErrorMessage");

  const retryJs = ts
    .transpileModule(retrySource, TS_OPTS)
    .outputText
    .replace('import "server-only";\r\n', "")
    .replace('import "server-only";\n', "")
    .replace('import { getErrorMessage } from "@/lib/error-message";\r\n', "")
    .replace('import { getErrorMessage } from "@/lib/error-message";\n', "");

  const encoded = Buffer.from(`${errorMessageJs}\n${retryJs}`, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function unavailableError() {
  return new Error(
    'got status: UNAVAILABLE. {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}',
  );
}

test("isRetryableGeminiError recognizes Gemini 503 UNAVAILABLE demand spikes", async () => {
  const { isRetryableGeminiError } = await loadGeminiRetryHelpers();

  assert.equal(isRetryableGeminiError(unavailableError()), true);
});

test("withGeminiRetries retries Gemini UNAVAILABLE errors up to three times", async () => {
  const { withGeminiRetries } = await loadGeminiRetryHelpers();
  let attempts = 0;

  const result = await withGeminiRetries(
    async () => {
      attempts += 1;
      if (attempts <= 3) {
        throw unavailableError();
      }
      return "ok";
    },
    { sleep: async () => undefined },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 4);
});

test("withGeminiRetries stops after three retries for repeated UNAVAILABLE errors", async () => {
  const { withGeminiRetries } = await loadGeminiRetryHelpers();
  let attempts = 0;

  await assert.rejects(
    () =>
      withGeminiRetries(
        async () => {
          attempts += 1;
          throw unavailableError();
        },
        { sleep: async () => undefined },
      ),
    /UNAVAILABLE/,
  );

  assert.equal(attempts, 4);
});
