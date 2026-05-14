/** Split Agent 1 %%FILE:...%% stream into a filename → content map. No validation. */
export function parseDelimitedDitaOutput(raw: string): Record<string, string> {
  const files: Record<string, string> = {};
  const fileRegex = /%%FILE:([^%]+)%%(?:\r?\n)([\s\S]*?)(?=%%FILE:|%%END%%|$)/g;
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(raw)) !== null) {
    const filename = match[1].trim();
    if (!filename) {
      continue;
    }
    files[filename] = match[2].trim();
  }

  return files;
}
