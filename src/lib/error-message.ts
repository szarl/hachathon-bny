/**
 * Turns thrown values and API error payloads into human-readable strings.
 * Avoids "[object Object]" for plain objects (e.g. Supabase / fetch failures).
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unknown error";
  }

  if (error instanceof Error) {
    const base = (error.message && error.message.trim()) || error.name || "Error";
    const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    if (cause !== undefined && cause !== null) {
      const c = getErrorMessage(cause);
      if (c && c !== base) {
        return `${base}: ${c}`;
      }
    }
    return base;
  }

  if (typeof AggregateError !== "undefined" && error instanceof AggregateError) {
    const parts = error.errors.map((e) => getErrorMessage(e)).filter(Boolean);
    const joined = parts.join("; ");
    if (joined) {
      return joined;
    }
    return (error.message && error.message.trim()) || "AggregateError";
  }

  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;

    const msg = rec.message;
    if (typeof msg === "string" && msg.trim()) {
      const details = rec.details;
      const hint = rec.hint;
      if (typeof details === "string" && details.trim()) {
        return `${msg} (${details})`;
      }
      if (typeof hint === "string" && hint.trim()) {
        return `${msg} (${hint})`;
      }
      return msg;
    }
    if (msg !== undefined && msg !== null) {
      const nested = getErrorMessage(msg);
      if (nested && nested !== "Unknown error") {
        return nested;
      }
    }

    for (const key of ["error", "err", "reason", "detail"] as const) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) {
        return v;
      }
      if (v !== undefined && v !== null && typeof v !== "number" && typeof v !== "boolean") {
        const nested = getErrorMessage(v);
        if (nested && nested !== "Unknown error") {
          return nested;
        }
      }
    }

    try {
      const s = JSON.stringify(error);
      if (s !== undefined && s !== "{}") {
        return s;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const s = JSON.stringify(error);
    if (s !== undefined) {
      return s;
    }
  } catch {
    /* ignore */
  }

  const fallback = String(error);
  if (fallback === "[object Object]") {
    return "Unknown error (see server logs)";
  }
  return fallback;
}
