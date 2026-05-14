import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import type { ExtractedPage } from "@/lib/classify";

type ExtractedAsset = NonNullable<ExtractedPage["images"]>[number];

export type HtmlGenerationStatus = "ok" | "skipped" | "failed";

export type DitaHtml5Result =
  | {
      status: "ok";
      /** Paths relative to the html5 output root (use under `html/` in ZIP or `preview/` in storage). */
      files: Map<string, Buffer>;
      /** Path within `files` keys for the browser entry page. */
      entryRelativePath: string;
    }
  | {
      status: "skipped" | "failed";
      message: string;
      logSnippet?: string;
    };

const DITA_TIMEOUT_MS = 120_000;
const MAX_LOG_SNIPPET = 2000;

function isDitaOtEnabled(): boolean {
  const v = process.env.DITA_OT_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function ditaOtStrict(): boolean {
  const v = process.env.DITA_OT_STRICT?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/** Resolve CLI path: `DITA_OT_DIR`/`bin`/dita[.bat] or bare `dita` on PATH. */
export function resolveDitaCliPath(): string | null {
  const dir = process.env.DITA_OT_DIR?.trim();
  if (dir) {
    const bin = join(dir, "bin", process.platform === "win32" ? "dita.bat" : "dita");
    if (existsSync(bin)) {
      return bin;
    }
  }
  return "dita";
}

/**
 * Pick the HTML file users should open first (DITA-OT html5 root).
 * Pure: `candidates` are posix-style relative paths under the output root.
 */
export function pickHtmlEntryRelativePath(candidates: string[]): string | null {
  const all = candidates.filter((p) => p.endsWith(".html") || p.endsWith(".htm"));
  if (all.length === 0) {
    return null;
  }

  const root = all.filter((p) => !p.includes("/"));
  if (root.includes("index.html")) {
    return "index.html";
  }
  if (root.includes("map.html")) {
    return "map.html";
  }
  if (root.length > 0) {
    return [...root].sort()[0] ?? null;
  }

  const nestedIndex = all.find((p) => p.endsWith("/index.html") || p.endsWith("/index.htm"));
  if (nestedIndex) {
    return nestedIndex;
  }

  return [...all].sort()[0] ?? null;
}

function walkFilesSync(rootDir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const root = resolve(rootDir);

  function walk(current: string): void {
    for (const name of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, name.name);
      const rel = relative(root, abs).split(sep).join("/");
      if (name.isDirectory()) {
        walk(abs);
      } else if (name.isFile()) {
        out.set(rel, readFileSync(abs));
      }
    }
  }

  walk(root);
  return out;
}

function writeWorkspace(
  workspace: string,
  files: Record<string, string>,
  assets: ExtractedAsset[],
  referencedImagePaths: Set<string>,
): void {
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(workspace, name), content, "utf8");
  }

  mkdirSync(join(workspace, "images"), { recursive: true });

  for (const asset of assets) {
    const normalized = asset.filename.replace(/\\/g, "/");
    const basename = normalized.split("/").pop() ?? asset.filename;
    const storagePath = `images/${basename}`;
    if (!referencedImagePaths.has(storagePath) || !asset.dataBase64 || asset.skipped) {
      continue;
    }
    writeFileSync(join(workspace, storagePath), Buffer.from(asset.dataBase64, "base64"));
  }
}

function getReferencedImagePaths(files: Record<string, string>): Set<string> {
  const paths = new Set<string>();
  for (const content of Object.values(files)) {
    for (const match of content.matchAll(/<image\b[^>]*\bhref=["']([^"']+)["']/g)) {
      const p = match[1].replace(/\\/g, "/");
      if (p.startsWith("images/")) {
        paths.add(p);
      }
    }
  }
  return paths;
}

/**
 * Run DITA-OT html5 on a temp copy of the validated file set (optional).
 * When `DITA_OT_ENABLED` is unset/false, returns `skipped` without touching disk.
 */
export function runDitaOtHtml5(
  files: Record<string, string>,
  assets: ExtractedAsset[] = [],
): DitaHtml5Result {
  if (!isDitaOtEnabled()) {
    return { status: "skipped", message: "DITA_OT_ENABLED is not set." };
  }

  if (!files["map.ditamap"]) {
    return { status: "failed", message: "map.ditamap is required for DITA-OT." };
  }

  const cli = resolveDitaCliPath();
  if (!cli) {
    return { status: "failed", message: "Could not resolve DITA-OT CLI." };
  }

  if (cli !== "dita" && !existsSync(cli)) {
    return { status: "failed", message: `DITA_OT_DIR bin not found: ${cli}` };
  }

  const workspace = mkdtempSync(join(tmpdir(), "dita-ot-"));
  const outDir = join(workspace, "html5-out");

  try {
    const referenced = getReferencedImagePaths(files);
    writeWorkspace(workspace, files, assets, referenced);

    const args = ["-i", "map.ditamap", "-f", "html5", "-o", "html5-out"];

    const result = spawnSync(cli, args, {
      cwd: workspace,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: DITA_TIMEOUT_MS,
      shell: process.platform === "win32" && cli.endsWith(".bat"),
    });

    if (result.error) {
      const msg = result.error.message;
      return {
        status: "failed",
        message: `DITA-OT spawn failed: ${msg}`,
        logSnippet: msg.slice(0, MAX_LOG_SNIPPET),
      };
    }

    if (result.status !== 0) {
      const combined = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      return {
        status: "failed",
        message: `DITA-OT exited with code ${result.status ?? "unknown"}.`,
        logSnippet: combined.slice(-MAX_LOG_SNIPPET),
      };
    }

    if (!existsSync(outDir)) {
      return { status: "failed", message: "DITA-OT did not create the output directory." };
    }

    const fileMap = walkFilesSync(outDir);
    if (fileMap.size === 0) {
      return { status: "failed", message: "DITA-OT produced no output files." };
    }

    const keys = [...fileMap.keys()];
    const entry = pickHtmlEntryRelativePath(keys);
    if (!entry) {
      return { status: "failed", message: "DITA-OT output contained no HTML files." };
    }

    return { status: "ok", files: fileMap, entryRelativePath: entry };
  } finally {
    try {
      rmSync(workspace, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export { ditaOtStrict };
