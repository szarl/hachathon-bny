import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

async function loadMapPool() {
  const path = fileURLToPath(new URL("../src/lib/batch-concurrency.ts", import.meta.url));
  const source = await readFile(path, "utf8");
  const js = ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: true,
      },
    })
    .outputText;
  const encoded = Buffer.from(js, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("mapPool preserves order and limits concurrency", async () => {
  const { mapPool } = await loadMapPool();
  const inFlight = { n: 0, max: 0 };
  const results = await mapPool(["a", "b", "c", "d", "e"], 2, async (letter, i) => {
    inFlight.n += 1;
    inFlight.max = Math.max(inFlight.max, inFlight.n);
    await new Promise((r) => setTimeout(r, 15));
    inFlight.n -= 1;
    return `${letter}${i}`;
  });
  assert.deepEqual(results, ["a0", "b1", "c2", "d3", "e4"]);
  assert.equal(inFlight.max, 2);
});
