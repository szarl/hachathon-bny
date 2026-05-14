import "server-only";

import { getErrorMessage } from "@/lib/error-message";

const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 750;
const MAX_DELAY_MS = 12_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attemptIndex: number): number {
  const exponential = BASE_DELAY_MS * 2 ** Math.max(0, attemptIndex - 1);
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(MAX_DELAY_MS, exponential + jitter);
}

const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);

const RETRYABLE_STATUS_STRING = new Set([
  "UNAVAILABLE",
  "RESOURCE_EXHAUSTED",
  "DEADLINE_EXCEEDED",
  "ABORTED",
]);

function scanValue(value: unknown, depth: number): boolean {
  if (depth > 10 || value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
    return RETRYABLE_STATUS_STRING.has(normalized);
  }

  if (Array.isArray(value)) {
    return value.some((entry) => scanValue(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.code === "number" && RETRYABLE_HTTP.has(obj.code)) {
    return true;
  }

  if (
    typeof obj.status === "string" &&
    RETRYABLE_STATUS_STRING.has(obj.status.trim().toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_"))
  ) {
    return true;
  }

  for (const v of Object.values(obj)) {
    if (scanValue(v, depth + 1)) {
      return true;
    }
  }

  return false;
}

/** True when the SDK or transport error is likely transient (capacity, retries help). */
export function isRetryableGeminiError(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 8 && current !== undefined && current !== null; i++) {
    if (scanValue(current, 0)) {
      return true;
    }
    if (current instanceof Error) {
      const message = current.message ?? "";
      if (
        /\b(?:503|502|504|429|500)\b/i.test(message) ||
        /\b(?:UNAVAILABLE|RESOURCE_EXHAUSTED|HIGH\s+DEMAND|TRY\s+AGAIN\s+LATER)/i.test(message)
      ) {
        return true;
      }
    }
    current =
      current instanceof Error && "cause" in current
        ? (current as Error & { cause?: unknown }).cause
        : undefined;
  }

  const flat = getErrorMessage(error);
  return (
    /\b(?:503|502|504|429|500)\b/.test(flat) ||
    /\b(?:UNAVAILABLE|RESOURCE_EXHAUSTED|HIGH\s+DEMAND|TRY\s+AGAIN\s+LATER)/i.test(flat)
  );
}

/**
 * Retries a Gemini call with exponential backoff when the error looks transient.
 * Does not retry on success or on non-retryable failures.
 */
export async function withGeminiRetries<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? DEFAULT_MAX_RETRIES));
  const maxAttempts = maxRetries + 1;
  const wait = options.sleep ?? sleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableGeminiError(error)) {
        throw error;
      }
      await wait(backoffDelayMs(attempt));
    }
  }

  throw lastError;
}
