import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

async function loadDitaHtml5Helpers() {
  const path = fileURLToPath(new URL("../src/lib/dita-html5.ts", import.meta.url));
  const fs = await import("node:fs/promises");
  const raw = await fs.readFile(path, "utf8");

  let js = ts.transpileModule(raw, TS_OPTS).outputText;
  js = js.replace(/\nexport \{ ditaOtStrict \};\s*$/m, "");
  js = js.replace(/^export (?=function|async|type|const|let|var|class)/gm, "");
  js +=
    "\nexport { pickHtmlEntryRelativePath, resolveDitaCliPath, runDitaOtHtml5, ditaOtStrict };";

  const encoded = Buffer.from(js, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("pickHtmlEntryRelativePath prefers root index then map then sorted root", async () => {
  const { pickHtmlEntryRelativePath } = await loadDitaHtml5Helpers();

  assert.equal(pickHtmlEntryRelativePath(["a.html", "index.html"]), "index.html");
  assert.equal(pickHtmlEntryRelativePath(["z.html", "map.html", "a.html"]), "map.html");
  assert.equal(pickHtmlEntryRelativePath(["zed.html", "alpha.html"]), "alpha.html");
});

test("pickHtmlEntryRelativePath uses nested index.html when no root HTML", async () => {
  const { pickHtmlEntryRelativePath } = await loadDitaHtml5Helpers();

  assert.equal(
    pickHtmlEntryRelativePath(["topics/intro/c.html", "topics/index.html"]),
    "topics/index.html",
  );
});

test("pickHtmlEntryRelativePath returns null when no html", async () => {
  const { pickHtmlEntryRelativePath } = await loadDitaHtml5Helpers();

  assert.equal(pickHtmlEntryRelativePath(["a.css", "b.js"]), null);
});

test("resolveDitaCliPath reads DITA_OT_DIR bin with dita.bat on win32", async () => {
  const { resolveDitaCliPath } = await loadDitaHtml5Helpers();

  const dir = mkdtempSync(join(tmpdir(), "fake-dita-"));
  const binDir = join(dir, "bin");
  mkdirSync(binDir, { recursive: true });
  const bat = join(binDir, "dita.bat");
  writeFileSync(bat, "@echo off\n");

  const orig = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  const prev = process.env.DITA_OT_DIR;
  process.env.DITA_OT_DIR = dir;
  try {
    assert.equal(resolveDitaCliPath(), bat);
  } finally {
    process.env.DITA_OT_DIR = prev;
    Object.defineProperty(process, "platform", { value: orig });
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveDitaCliPath falls back to dita on PATH when dir missing", async () => {
  const { resolveDitaCliPath } = await loadDitaHtml5Helpers();

  const prev = process.env.DITA_OT_DIR;
  process.env.DITA_OT_DIR = join(tmpdir(), "nonexistent-dita-ot-xyz");
  try {
    assert.equal(resolveDitaCliPath(), "dita");
  } finally {
    process.env.DITA_OT_DIR = prev;
  }
});
