export type JsonResponseContext = {
  label: string;
  url: string;
  status: number;
  statusText: string;
  contentType: string | null;
};

const RESPONSE_PREVIEW_CHARS = 500;

export async function readJsonResponse<T>(
  response: Response,
  context: Pick<JsonResponseContext, "label" | "url">,
): Promise<T> {
  const text = await response.text();
  const fullContext: JsonResponseContext = {
    ...context,
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
  };

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(formatNonJsonResponseError(fullContext, text));
  }
}

export function formatNonJsonResponseError(
  context: JsonResponseContext,
  body: string,
): string {
  const preview = body.trim().replace(/\s+/g, " ").slice(0, RESPONSE_PREVIEW_CHARS);
  const contentType = context.contentType || "unknown content type";
  const statusText = context.statusText ? ` ${context.statusText}` : "";
  const suffix = preview ? ` Body starts with: ${preview}` : " Body was empty.";

  return `${context.label} returned non-JSON (${context.status}${statusText}, ${contentType}) from ${context.url}.${suffix}`;
}
