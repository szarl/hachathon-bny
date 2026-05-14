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

async function loadTokenUsageHelpers() {
  const tokenUsagePath = fileURLToPath(new URL("../src/lib/token-usage.ts", import.meta.url));
  const source = await readFile(tokenUsagePath, "utf8");
  const js = ts.transpileModule(source, TS_OPTS).outputText;
  const encoded = Buffer.from(js, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("normalizeGeminiTokenUsage reads candidatesTokenCount output metadata", async () => {
  const { normalizeGeminiTokenUsage } = await loadTokenUsageHelpers();

  assert.deepEqual(
    normalizeGeminiTokenUsage("agent1", "gemini-test", {
      promptTokenCount: 100,
      candidatesTokenCount: 25,
      thoughtsTokenCount: 5,
      toolUsePromptTokenCount: 3,
      cachedContentTokenCount: 2,
      totalTokenCount: 133,
    }),
    {
      phase: "agent1",
      model: "gemini-test",
      prompt: 100,
      output: 25,
      thoughts: 5,
      toolUse: 3,
      cached: 2,
      total: 133,
    },
  );
});

test("normalizeGeminiTokenUsage reads responseTokenCount output metadata", async () => {
  const { normalizeGeminiTokenUsage } = await loadTokenUsageHelpers();

  assert.deepEqual(
    normalizeGeminiTokenUsage("agent2", "gemini-test", {
      promptTokenCount: 75,
      responseTokenCount: 40,
      totalTokenCount: 115,
    }),
    {
      phase: "agent2",
      model: "gemini-test",
      prompt: 75,
      output: 40,
      thoughts: 0,
      toolUse: 0,
      cached: 0,
      total: 115,
    },
  );
});

test("summarizeTokenUsage aggregates token counts across calls", async () => {
  const { summarizeTokenUsage } = await loadTokenUsageHelpers();

  assert.deepEqual(
    summarizeTokenUsage([
      {
        phase: "classify",
        model: "gemini-a",
        prompt: 100,
        output: 20,
        thoughts: 4,
        toolUse: 1,
        cached: 3,
        total: 125,
      },
      {
        phase: "agent1",
        model: "gemini-b",
        prompt: 200,
        output: 80,
        thoughts: 6,
        toolUse: 2,
        cached: 5,
        total: 288,
      },
    ]),
    {
      prompt: 300,
      output: 100,
      thoughts: 10,
      toolUse: 3,
      cached: 8,
      total: 413,
      calls: [
        {
          phase: "classify",
          model: "gemini-a",
          prompt: 100,
          output: 20,
          thoughts: 4,
          toolUse: 1,
          cached: 3,
          total: 125,
        },
        {
          phase: "agent1",
          model: "gemini-b",
          prompt: 200,
          output: 80,
          thoughts: 6,
          toolUse: 2,
          cached: 5,
          total: 288,
        },
      ],
    },
  );
});

test("formatTokenTotal keeps table values compact", async () => {
  const { formatTokenTotal } = await loadTokenUsageHelpers();

  assert.equal(formatTokenTotal(0), "0");
  assert.equal(formatTokenTotal(999), "999");
  assert.equal(formatTokenTotal(1200), "1.2k");
  assert.equal(formatTokenTotal(12400), "12.4k");
  assert.equal(formatTokenTotal(1200000), "1.2m");
});
